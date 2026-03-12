"""
main.py — FastAPI server for MeetMind
Endpoints:
  POST /session/start
  POST /session/end/{meeting_id}
  POST /analyze/frame
  GET  /live/{meeting_id}
  GET  /report/{meeting_id}
  GET  /
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import (
    create_session,
    end_session,
    get_session,
    insert_emotion_log,
    get_latest_emotions,
    get_full_report,
)
from emotion_detector import detect_emotions

app = FastAPI(title="MeetMind API", version="1.0.0")

# Allow Chrome extension (chrome-extension://*) and local dev frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────

class FrameRequest(BaseModel):
    frame: str                  # base64 JPEG
    participant_name: str = "unknown"
    meeting_id: str = "demo"


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"service": "MeetMind API", "status": "running"}


# ── Session endpoints ─────────────────────────────────────────────────────────

@app.post("/session/start")
async def session_start():
    """Create a new meeting session and return its ID."""
    meeting_id = create_session()
    return {"meeting_id": meeting_id, "status": "started"}


@app.post("/session/end/{meeting_id}")
async def session_end(meeting_id: str):
    """Finalise a session and return its summary."""
    session = end_session(meeting_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    report = get_full_report(meeting_id)
    return {"session": session, "summary": _build_summary(report["logs"])}


# ── Frame analysis ────────────────────────────────────────────────────────────

@app.post("/analyze/frame")
async def analyze_frame(req: FrameRequest):
    """
    Detect all faces in the frame, run DeepFace emotion analysis,
    and persist each result to the session log.
    """
    faces = detect_emotions(req.frame)

    if not faces:
        return {"meeting_id": req.meeting_id, "faces": [], "participant_name": req.participant_name}

    for face in faces:
        if "error" in face:
            continue
        insert_emotion_log(
            meeting_id=req.meeting_id,
            participant_name=req.participant_name,
            face_id=face["face_id"],
            dominant_emotion=face["dominant_emotion"],
            emotions=face["emotion_scores"],
            confidence=face["confidence"],
        )

    return {
        "meeting_id": req.meeting_id,
        "participant_name": req.participant_name,
        "faces": faces,
    }


# ── Live & Report endpoints ───────────────────────────────────────────────────

@app.get("/live/{meeting_id}")
async def live_emotions(meeting_id: str):
    """Return the latest detected emotion per participant."""
    latest = get_latest_emotions(meeting_id)
    return {"meeting_id": meeting_id, "participants": latest}


@app.get("/report/{meeting_id}")
async def full_report(meeting_id: str):
    """Return the full per-person emotion timeline and summary stats."""
    session = get_session(meeting_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    report = get_full_report(meeting_id)
    logs = report["logs"]
    return {
        "session": session,
        "logs": logs,
        "summary": _build_summary(logs),
        "per_participant": _per_participant_stats(logs),
    }


# ── Internal helpers ──────────────────────────────────────────────────────────

EMOTION_KEYS = ["happy", "sad", "angry", "fear", "surprise", "disgust", "neutral"]


def _build_summary(logs: list[dict]) -> dict:
    if not logs:
        return {}
    participants = list({l["participant_name"] for l in logs})
    total_frames = len(logs)

    # Average emotion scores across all frames
    avg = {k: 0.0 for k in EMOTION_KEYS}
    for log in logs:
        for k in EMOTION_KEYS:
            avg[k] += log.get(k, 0)
    avg = {k: round(v / total_frames, 2) for k, v in avg.items()}

    engagement = round((avg["happy"] + avg["surprise"]) * 100 - (avg["sad"] + avg["angry"] + avg["disgust"]) * 50, 1)
    stress = round((avg["angry"] + avg["fear"] + avg["disgust"]) * 100, 1)

    return {
        "total_participants": len(participants),
        "total_frames": total_frames,
        "avg_emotions": avg,
        "engagement_score": max(0, min(100, engagement)),
        "stress_index": max(0, min(100, stress)),
    }


def _per_participant_stats(logs: list[dict]) -> list[dict]:
    """Group logs by participant and compute individual stats."""
    from collections import defaultdict
    grouped: dict[str, list[dict]] = defaultdict(list)
    for log in logs:
        grouped[log["participant_name"]].append(log)

    result = []
    for name, entries in grouped.items():
        n = len(entries)
        avg = {k: round(sum(e.get(k, 0) for e in entries) / n, 2) for k in EMOTION_KEYS}
        # dominant = emotion with highest avg
        dominant = max(avg, key=lambda k: avg[k])
        engagement = round((avg["happy"] + avg["surprise"]) * 100 - (avg["sad"] + avg["angry"] + avg["disgust"]) * 50, 1)
        stress = round((avg["angry"] + avg["fear"] + avg["disgust"]) * 100, 1)

        result.append({
            "participant_name": name,
            "frame_count": n,
            "avg_emotions": avg,
            "dominant_emotion": dominant,
            "engagement_score": max(0, min(100, engagement)),
            "stress_index": max(0, min(100, stress)),
            "timeline": entries,
        })
    return result
