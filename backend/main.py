"""
main.py — MeetMind FastAPI server (redesigned)

Endpoints:
  POST /session/start       → create session with real Meet API conference ID
  POST /session/end/{id}    → end session
  POST /analyze/frame       → emotion detection + DB insert
  GET  /live/{id}           → latest emotion per participant
  GET  /report/{id}         → full report
  GET  /meetings            → ended sessions with emotion data ONLY
  GET  /report/{id}/download/*  → CSV/JSON/ZIP downloads
  GET  /meetings/download/all  → master CSV
"""

import csv
import io
import json
import zipfile
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from database import (
    count_frames, create_session, end_session,
    get_dominant_emotions_per_participant, get_full_report,
    get_latest_emotions, get_session, get_session_participant_names,
    insert_emotion_log, list_ended_sessions_with_data,
)
from emotion_detector import detect_emotions
from meet_api import (
    generate_fallback_id, get_conference_participants,
    get_latest_conference,
)

app = FastAPI(title="MeetMind API", version="3.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

EMOTION_KEYS = ["happy", "sad", "angry", "fear", "surprise", "disgust", "neutral"]


class FrameRequest(BaseModel):
    frame: str
    participant_name: str = "unknown"
    meeting_id: str = "demo"
    face_index: Optional[int] = None


@app.get("/")
async def root():
    return {"service": "MeetMind API", "version": "3.0.0", "status": "running"}


# ── Session ───────────────────────────────────────────────────────────────────

@app.post("/session/start")
async def session_start(room_code: str = Query(default="")):
    print(f"[/session/start] Called with room_code={room_code!r}")
    conference_id = None
    participant_names = []
    space_id = ""
    started_at = None
    from_api = False

    conf = get_latest_conference()
    if conf:
        conference_id = conf["conference_id"]
        space_id = conf["space_id"]
        started_at = conf["started_at"]
        from_api = True
        participant_names = get_conference_participants(conference_id)
        print(f"[/session/start] Got conference from Meet API: {conference_id!r}")
    else:
        print("[/session/start] Meet API returned nothing — using fallback ID")

    if not conference_id:
        conference_id = generate_fallback_id(room_code)
        print(f"[/session/start] Fallback ID generated: {conference_id!r}")

    mid = create_session(
        meeting_id=conference_id, space_id=space_id,
        started_at=started_at, participant_names=participant_names,
    )
    print(f"[/session/start] Session saved to DB with id: {mid!r}")
    return {
        "conference_id": mid, "meeting_id": mid,
        "space_id": space_id, "participant_names": participant_names,
        "from_api": from_api, "status": "started",
    }


@app.post("/session/end/{meeting_id:path}")
async def session_end(meeting_id: str):
    print(f"[/session/end] Called for meeting_id={meeting_id!r}")
    session = end_session(meeting_id)
    if not session:
        print(f"[/session/end] WARNING: session not found for {meeting_id!r}")
        raise HTTPException(404, "Session not found")
    print(f"[/session/end] Session ended and updated in DB: {meeting_id!r}")
    report = get_full_report(meeting_id)
    return {"session": session, "summary": _build_summary(report["logs"])}


# ── Frame analysis ────────────────────────────────────────────────────────────

_NEUTRAL_FACE = {
    "face_id": 0,
    "dominant_emotion": "neutral",
    "emotion_scores": {k: 0.0 for k in EMOTION_KEYS},
    "confidence": 0.0,
    "fallback": True,
}


@app.post("/analyze/frame")
async def analyze_frame(req: FrameRequest):
    print(f"[/analyze/frame] Received request | meeting_id={req.meeting_id!r} | participant={req.participant_name!r} | frame_len={len(req.frame)}")
    participant_name = _resolve_name(req.meeting_id, req.participant_name, req.face_index)
    faces = detect_emotions(req.frame)

    # emotion_detector now always returns a non-empty list, but guard anyway
    if not faces:
        print("[/analyze/frame] detector returned empty — substituting neutral fallback")
        faces = [dict(_NEUTRAL_FACE)]

    written = 0
    for face in faces:
        face_name = _resolve_name(req.meeting_id, req.participant_name, face["face_id"])
        insert_emotion_log(
            meeting_id=req.meeting_id, participant_name=face_name,
            face_id=face["face_id"], dominant_emotion=face["dominant_emotion"],
            emotions=face.get("emotion_scores", {k: 0.0 for k in EMOTION_KEYS}),
            confidence=face.get("confidence", 0.0),
        )
        written += 1

    print(f"[/analyze/frame] Wrote {written} face(s) to DB | emotions={[f['dominant_emotion'] for f in faces]}")
    return {"meeting_id": req.meeting_id, "participant_name": participant_name, "faces": faces}


# ── Live & Report ─────────────────────────────────────────────────────────────

@app.get("/live/{meeting_id:path}")
async def live_emotions(meeting_id: str):
    print(f"[/live] GET called with meeting_id={meeting_id!r}")

    # Try exact match first
    participants = get_latest_emotions(meeting_id)
    print(f"[/live] Exact match found {len(participants)} participant(s)")

    # Fuzzy fallback: the extension sends the short room code (e.g. 'atu-nmaf-bhh')
    # but the DB might store the full Meet API path (e.g. 'conferenceRecords/abc123')
    if not participants:
        print(f"[/live] No exact match — trying LIKE fuzzy match for {meeting_id!r}")
        # Extract the last segment (room code) in case a full path was passed
        short_id = meeting_id.split('/')[-1]
        from database import _conn
        with _conn() as conn:
            rows = conn.execute(
                """SELECT * FROM emotion_logs
                   WHERE (meeting_id = ? OR meeting_id LIKE ? OR meeting_id LIKE ?)
                   AND id IN (
                     SELECT MAX(id) FROM emotion_logs
                     WHERE meeting_id = ? OR meeting_id LIKE ? OR meeting_id LIKE ?
                     GROUP BY participant_name
                   ) ORDER BY participant_name""",
                (meeting_id, f"%{short_id}%", f"%{meeting_id}%",
                 meeting_id, f"%{short_id}%", f"%{meeting_id}%"),
            ).fetchall()
        participants = [dict(r) for r in rows]
        print(f"[/live] Fuzzy match found {len(participants)} participant(s)")

    # Normalize emotion values for old data
    participants = [_normalize_emotion_values(p) for p in participants]

    return {"meeting_id": meeting_id, "participants": participants}


@app.get("/report/{meeting_id:path}")
async def full_report(meeting_id: str):
    print(f"[MeetMind] GET /report/{meeting_id}")
    session = get_session(meeting_id)

    # Fallback: try LIKE match if exact ID not found
    # (handles short IDs vs full conferenceRecords/xyz paths)
    if not session:
        from database import _conn
        with _conn() as conn:
            row = conn.execute(
                "SELECT * FROM sessions WHERE meeting_id LIKE ?",
                (f"%{meeting_id.split('/')[-1]}%",),
            ).fetchone()
        if row:
            from database import _session_dict
            session = _session_dict(row)
            meeting_id = session["meeting_id"]  # use the full stored ID
            print(f"[MeetMind] Fuzzy matched to: {meeting_id}")

    if not session:
        raise HTTPException(404, f"Session not found: {meeting_id}")

    report = get_full_report(meeting_id)
    logs = report["logs"]
    return {
        "session": session, "logs": logs,
        "summary": _build_summary(logs),
        "per_participant": _per_participant_stats(logs),
    }


# ── Meetings list — ONLY ended sessions with emotion data ────────────────────

@app.get("/meetings")
async def list_meetings():
    print("[/meetings] GET called")
    sessions = list_ended_sessions_with_data()
    print(f"[/meetings] Found {len(sessions)} session(s) with emotion data")
    result = []
    for s in sessions:
        mid = s["meeting_id"]
        dominant = get_dominant_emotions_per_participant(mid)
        result.append({
            "conference_id": mid,
            "space_id": s.get("space_id", ""),
            "started_at": s["started_at"],
            "ended_at": s.get("ended_at"),
            "duration_seconds": s.get("duration_seconds", 0),
            "participant_names": s.get("participant_names", []),
            "total_frames": s.get("total_frames", 0),
            "dominant_emotions": dominant,
        })
    return {"meetings": result, "total": len(result)}


# ── Downloads ─────────────────────────────────────────────────────────────────

def _resolve_meeting_id(meeting_id: str) -> str:
    """Resolve meeting_id with fuzzy matching if exact match not found."""
    session = get_session(meeting_id)
    if session:
        return meeting_id
    
    # Fallback: try LIKE match
    from database import _conn
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM sessions WHERE meeting_id LIKE ?",
            (f"%{meeting_id.split('/')[-1]}%",),
        ).fetchone()
    if row:
        from database import _session_dict
        session = _session_dict(row)
        resolved_id = session["meeting_id"]
        print(f"[Download] Fuzzy matched {meeting_id!r} to {resolved_id!r}")
        return resolved_id
    
    raise HTTPException(404, f"Session not found: {meeting_id}")


@app.get("/report/{meeting_id:path}/download/raw")
async def download_raw(meeting_id: str):
    meeting_id = _resolve_meeting_id(meeting_id)
    report = get_full_report(meeting_id)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=[
        "timestamp","participant_name","dominant_emotion",
        "happy","sad","angry","fear","surprise","disgust","neutral","confidence",
    ], extrasaction="ignore")
    w.writeheader(); w.writerows(report.get("logs", []))
    return StreamingResponse(io.BytesIO(buf.getvalue().encode()), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="emotions_raw.csv"'})


@app.get("/report/{meeting_id:path}/download/summary")
async def download_summary(meeting_id: str):
    meeting_id = _resolve_meeting_id(meeting_id)
    pp = _per_participant_stats(get_full_report(meeting_id).get("logs", []))
    buf = io.StringIO()
    fields = ["participant_name","dominant_emotion","avg_happy","avg_sad","avg_angry",
              "avg_fear","avg_surprise","avg_disgust","avg_neutral",
              "engagement_score","stress_index","total_samples"]
    w = csv.DictWriter(buf, fieldnames=fields)
    w.writeheader()
    for p in pp:
        avg = p.get("avg_emotions", {})
        w.writerow({
            "participant_name": p["participant_name"], "dominant_emotion": p["dominant_emotion"],
            **{f"avg_{k}": avg.get(k, 0) for k in EMOTION_KEYS},
            "engagement_score": p["engagement_score"], "stress_index": p["stress_index"],
            "total_samples": p["frame_count"],
        })
    return StreamingResponse(io.BytesIO(buf.getvalue().encode()), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="emotions_summary.csv"'})


@app.get("/report/{meeting_id:path}/download/metadata")
async def download_metadata(meeting_id: str):
    meeting_id = _resolve_meeting_id(meeting_id)
    session = get_session(meeting_id)
    if not session: raise HTTPException(404, "Session not found")
    return StreamingResponse(io.BytesIO(json.dumps(session, indent=2).encode()),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="meeting_metadata.json"'})


@app.get("/report/{meeting_id:path}/download/zip")
async def download_zip(meeting_id: str):
    meeting_id = _resolve_meeting_id(meeting_id)
    report = get_full_report(meeting_id)
    session, logs = report.get("session", {}), report.get("logs", [])
    pp = _per_participant_stats(logs)

    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w", zipfile.ZIP_DEFLATED) as zf:
        raw = io.StringIO()
        rw = csv.DictWriter(raw, fieldnames=[
            "timestamp","participant_name","dominant_emotion",
            "happy","sad","angry","fear","surprise","disgust","neutral","confidence",
        ], extrasaction="ignore")
        rw.writeheader(); rw.writerows(logs)
        zf.writestr("emotions_raw.csv", raw.getvalue())

        sbuf = io.StringIO()
        sw = csv.DictWriter(sbuf, fieldnames=[
            "participant_name","dominant_emotion","avg_happy","avg_sad","avg_angry",
            "avg_fear","avg_surprise","avg_disgust","avg_neutral",
            "engagement_score","stress_index","total_samples",
        ])
        sw.writeheader()
        for p in pp:
            avg = p.get("avg_emotions", {})
            sw.writerow({
                "participant_name": p["participant_name"], "dominant_emotion": p["dominant_emotion"],
                **{f"avg_{k}": avg.get(k, 0) for k in EMOTION_KEYS},
                "engagement_score": p["engagement_score"], "stress_index": p["stress_index"],
                "total_samples": p["frame_count"],
            })
        zf.writestr("emotions_summary.csv", sbuf.getvalue())
        zf.writestr("meeting_metadata.json", json.dumps(session, indent=2))

    zbuf.seek(0)
    return StreamingResponse(zbuf, media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="meetmind_{meeting_id.split("/")[-1]}.zip"'})


@app.get("/meetings/download/all")
async def download_all():
    sessions = list_ended_sessions_with_data()
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=[
        "conference_id","date","participant_name","dominant_emotion",
        "happy","sad","angry","fear","surprise","disgust","neutral","confidence","timestamp",
    ], extrasaction="ignore")
    w.writeheader()
    for s in sessions:
        mid = s["meeting_id"]
        date = (s.get("started_at") or "")[:10]
        for log in get_full_report(mid).get("logs", []):
            w.writerow({"conference_id": mid, "date": date,
                **{k: log.get(k, "") for k in [
                    "participant_name","dominant_emotion","happy","sad","angry",
                    "fear","surprise","disgust","neutral","confidence","timestamp",
                ]}})
    return StreamingResponse(io.BytesIO(buf.getvalue().encode()), media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="meetmind_all.csv"'})


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_name(meeting_id, raw_name, face_index):
    placeholders = {"frame_person", "unknown", "", "participant"}
    if raw_name and raw_name.lower() not in placeholders:
        return raw_name
    names = get_session_participant_names(meeting_id)
    idx = face_index or 0
    if names and idx < len(names):
        return names[idx]
    return f"Participant_{idx + 1}"


def _normalize_emotion_values(log_entry):
    """
    Normalize emotion values to 0-1 range.
    Old data may have values in 0-100 range, new data is in 0-1 range.
    Detect and convert if needed.
    """
    normalized = dict(log_entry)
    # Check if any emotion value is > 1.5 (indicating 0-100 range)
    max_val = max(log_entry.get(k, 0) for k in EMOTION_KEYS)
    if max_val > 1.5:
        # Old format (0-100), convert to 0-1
        for k in EMOTION_KEYS:
            normalized[k] = log_entry.get(k, 0) / 100.0
    return normalized


def _build_summary(logs):
    if not logs: return {}
    # Normalize all log entries first
    logs = [_normalize_emotion_values(l) for l in logs]
    participants = list({l["participant_name"] for l in logs})
    n = len(logs)
    avg = {k: round(sum(l.get(k, 0) for l in logs) / n, 2) for k in EMOTION_KEYS}
    eng = round((avg["happy"] + avg["surprise"]) * 100 - (avg["sad"] + avg["angry"] + avg["disgust"]) * 50, 1)
    stress = round((avg["angry"] + avg["fear"] + avg["disgust"]) * 100, 1)
    return {
        "total_participants": len(participants), "total_frames": n, "avg_emotions": avg,
        "engagement_score": max(0, min(100, eng)), "stress_index": max(0, min(100, stress)),
    }


def _per_participant_stats(logs):
    from collections import defaultdict
    # Normalize all log entries first
    logs = [_normalize_emotion_values(l) for l in logs]
    grouped = defaultdict(list)
    for l in logs:
        grouped[l["participant_name"]].append(l)
    result = []
    for name, entries in grouped.items():
        n = len(entries)
        avg = {k: round(sum(e.get(k, 0) for e in entries) / n, 2) for k in EMOTION_KEYS}
        dominant = max(avg, key=lambda k: avg[k])
        eng = round((avg["happy"] + avg["surprise"]) * 100 - (avg["sad"] + avg["angry"] + avg["disgust"]) * 50, 1)
        stress = round((avg["angry"] + avg["fear"] + avg["disgust"]) * 100, 1)
        result.append({
            "participant_name": name, "frame_count": n, "avg_emotions": avg,
            "dominant_emotion": dominant,
            "engagement_score": max(0, min(100, eng)), "stress_index": max(0, min(100, stress)),
            "timeline": entries,
        })
    return result
