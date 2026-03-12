"""
database.py — SQLite persistence for MeetMind (redesigned)
"""

import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "meetmind.db"


def _conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                meeting_id        TEXT PRIMARY KEY,
                space_id          TEXT DEFAULT '',
                started_at        TEXT NOT NULL,
                ended_at          TEXT,
                status            TEXT DEFAULT 'active',
                participant_names TEXT DEFAULT '[]',
                duration_seconds  INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS emotion_logs (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id       TEXT NOT NULL,
                participant_name TEXT NOT NULL DEFAULT 'unknown',
                face_id          INTEGER NOT NULL DEFAULT 0,
                timestamp        TEXT NOT NULL,
                dominant_emotion TEXT NOT NULL,
                happy            REAL DEFAULT 0,
                sad              REAL DEFAULT 0,
                angry            REAL DEFAULT 0,
                fear             REAL DEFAULT 0,
                surprise         REAL DEFAULT 0,
                disgust          REAL DEFAULT 0,
                neutral          REAL DEFAULT 0,
                confidence       REAL DEFAULT 0,
                FOREIGN KEY (meeting_id) REFERENCES sessions(meeting_id)
            );
        """)
        # Migrate existing table if needed
        cols = {r[1] for r in conn.execute("PRAGMA table_info(sessions)").fetchall()}
        for col, defn in [("space_id", "TEXT DEFAULT ''"),
                          ("participant_names", "TEXT DEFAULT '[]'"),
                          ("duration_seconds", "INTEGER DEFAULT 0")]:
            if col not in cols:
                conn.execute(f"ALTER TABLE sessions ADD COLUMN {col} {defn}")


# ── Sessions ──────────────────────────────────────────────────────────────────

def create_session(meeting_id=None, space_id="", started_at=None, participant_names=None):
    mid   = meeting_id or str(uuid.uuid4())[:8].upper()
    now   = started_at or datetime.utcnow().isoformat()
    names = json.dumps(participant_names or [])
    with _conn() as conn:
        conn.execute(
            """INSERT INTO sessions (meeting_id, space_id, started_at, participant_names, status)
               VALUES (?,?,?,?,'active')
               ON CONFLICT(meeting_id) DO UPDATE SET
                 space_id=excluded.space_id, started_at=excluded.started_at,
                 participant_names=excluded.participant_names, status='active'""",
            (mid, space_id, now, names),
        )
    return mid


def end_session(meeting_id):
    now = datetime.utcnow().isoformat()
    with _conn() as conn:
        conn.execute(
            "UPDATE sessions SET ended_at=?, status='ended' WHERE meeting_id=?",
            (now, meeting_id),
        )
        row = conn.execute("SELECT * FROM sessions WHERE meeting_id=?", (meeting_id,)).fetchone()
    return _session_dict(row) if row else None


def get_session(meeting_id):
    with _conn() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE meeting_id=?", (meeting_id,)).fetchone()
    return _session_dict(row) if row else None


def get_session_participant_names(meeting_id):
    s = get_session(meeting_id)
    return s.get("participant_names", []) if s else []


def list_ended_sessions_with_data():
    """
    Return sessions that have at least 1 emotion_log.
    Does NOT require ended_at to be set — sessions show up in history
    as long as frames were captured, even if session/end never fired.
    """
    print("[database] list_ended_sessions_with_data called")
    with _conn() as conn:
        rows = conn.execute("""
            SELECT s.*, COUNT(e.id) AS total_frames
            FROM sessions s
            INNER JOIN emotion_logs e ON s.meeting_id = e.meeting_id
            GROUP BY s.meeting_id
            HAVING COUNT(e.id) > 0
            ORDER BY s.started_at DESC
        """).fetchall()
    print(f"[database] Found {len(rows)} session(s) with emotion data")
    result = []
    for r in rows:
        d = _session_dict(r)
        d["total_frames"] = r["total_frames"]
        result.append(d)
    return result


def _session_dict(row):
    d = dict(row)
    try:
        d["participant_names"] = json.loads(d.get("participant_names") or "[]")
    except Exception:
        d["participant_names"] = []
    return d


# ── Emotion logs ──────────────────────────────────────────────────────────────

def insert_emotion_log(meeting_id, participant_name, face_id, dominant_emotion, emotions, confidence):
    now = datetime.utcnow().isoformat()
    with _conn() as conn:
        conn.execute(
            """INSERT INTO emotion_logs
              (meeting_id, participant_name, face_id, timestamp,
               dominant_emotion, happy, sad, angry, fear, surprise, disgust, neutral, confidence)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (meeting_id, participant_name, face_id, now, dominant_emotion,
             emotions.get("happy",0), emotions.get("sad",0), emotions.get("angry",0),
             emotions.get("fear",0), emotions.get("surprise",0), emotions.get("disgust",0),
             emotions.get("neutral",0), confidence),
        )


def get_latest_emotions(meeting_id):
    """
    Most recent emotion log per participant (by MAX id).
    Tries exact match first; falls back to LIKE match to handle
    mismatches between short room codes and full Meet API conference IDs.
    """
    print(f"[database] get_latest_emotions called with meeting_id={meeting_id!r}")

    with _conn() as conn:
        rows = conn.execute(
            """SELECT * FROM emotion_logs
               WHERE meeting_id=? AND id IN (
                 SELECT MAX(id) FROM emotion_logs WHERE meeting_id=? GROUP BY participant_name
               ) ORDER BY participant_name""",
            (meeting_id, meeting_id),
        ).fetchall()

    print(f"[database] Exact match found {len(rows)} row(s)")

    if rows:
        return [dict(r) for r in rows]

    # Fuzzy fallback: strip any leading path segments and match by the short code
    # e.g. meeting_id='atu-nmaf-bhh' matches stored 'conferenceRecords/xyz?roomCode=atu-nmaf-bhh'
    short_id = meeting_id.split("/")[-1]
    print(f"[database] Trying LIKE fallback with short_id={short_id!r}")

    with _conn() as conn:
        rows = conn.execute(
            """SELECT * FROM emotion_logs
               WHERE (meeting_id LIKE ? OR meeting_id LIKE ?)
               AND id IN (
                 SELECT MAX(id) FROM emotion_logs
                 WHERE meeting_id LIKE ? OR meeting_id LIKE ?
                 GROUP BY participant_name
               ) ORDER BY participant_name""",
            (f"%{short_id}%", f"%{meeting_id}%",
             f"%{short_id}%", f"%{meeting_id}%"),
        ).fetchall()

    print(f"[database] LIKE fallback found {len(rows)} row(s)")
    return [dict(r) for r in rows]


def get_full_report(meeting_id):
    session = get_session(meeting_id)
    with _conn() as conn:
        logs = conn.execute(
            "SELECT * FROM emotion_logs WHERE meeting_id=? ORDER BY timestamp",
            (meeting_id,),
        ).fetchall()
    return {"session": session, "logs": [dict(r) for r in logs]}


def count_frames(meeting_id):
    with _conn() as conn:
        row = conn.execute("SELECT COUNT(*) FROM emotion_logs WHERE meeting_id=?", (meeting_id,)).fetchone()
    return row[0] if row else 0


def get_dominant_emotions_per_participant(meeting_id):
    """Return {participant_name: dominant_emotion} for each participant."""
    with _conn() as conn:
        rows = conn.execute(
            """SELECT participant_name, dominant_emotion, COUNT(*) as cnt
               FROM emotion_logs WHERE meeting_id=?
               GROUP BY participant_name, dominant_emotion
               ORDER BY participant_name, cnt DESC""",
            (meeting_id,),
        ).fetchall()
    result = {}
    for r in rows:
        name = r["participant_name"]
        if name not in result:  # first = most frequent
            result[name] = r["dominant_emotion"]
    return result


init_db()
