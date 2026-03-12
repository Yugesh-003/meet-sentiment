"""
database.py — SQLite persistence layer for MeetMind (fixed).
get_latest_emotions() rewritten to use a simpler, correct subquery
that avoids the join ambiguity issue with repeated participant names.
"""

import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "meetmind.db"


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist."""
    with _conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                meeting_id   TEXT PRIMARY KEY,
                started_at   TEXT NOT NULL,
                ended_at     TEXT,
                status       TEXT DEFAULT 'active'
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


# ── Session helpers ───────────────────────────────────────────────────────────

def create_session() -> str:
    meeting_id = str(uuid.uuid4())[:8].upper()
    now = datetime.utcnow().isoformat()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO sessions (meeting_id, started_at) VALUES (?, ?)",
            (meeting_id, now),
        )
    return meeting_id


def end_session(meeting_id: str) -> dict | None:
    now = datetime.utcnow().isoformat()
    with _conn() as conn:
        conn.execute(
            "UPDATE sessions SET ended_at=?, status='ended' WHERE meeting_id=?",
            (now, meeting_id),
        )
        row = conn.execute(
            "SELECT * FROM sessions WHERE meeting_id=?", (meeting_id,)
        ).fetchone()
    return dict(row) if row else None


def get_session(meeting_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM sessions WHERE meeting_id=?", (meeting_id,)
        ).fetchone()
    return dict(row) if row else None


# ── Emotion log helpers ───────────────────────────────────────────────────────

def insert_emotion_log(
    meeting_id: str,
    participant_name: str,
    face_id: int,
    dominant_emotion: str,
    emotions: dict,
    confidence: float,
):
    now = datetime.utcnow().isoformat()
    with _conn() as conn:
        conn.execute(
            """
            INSERT INTO emotion_logs
              (meeting_id, participant_name, face_id, timestamp,
               dominant_emotion, happy, sad, angry, fear, surprise,
               disgust, neutral, confidence)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                meeting_id, participant_name, face_id, now,
                dominant_emotion,
                emotions.get("happy",    0),
                emotions.get("sad",      0),
                emotions.get("angry",    0),
                emotions.get("fear",     0),
                emotions.get("surprise", 0),
                emotions.get("disgust",  0),
                emotions.get("neutral",  0),
                confidence,
            ),
        )


def get_latest_emotions(meeting_id: str) -> list[dict]:
    """
    Return the single most-recent emotion log per participant for meeting_id.
    Uses a correlated subquery (MAX id per participant) which is unambiguous
    even when timestamps match (e.g., fast inserts within the same second).
    """
    with _conn() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM emotion_logs
            WHERE meeting_id = ?
              AND id IN (
                  SELECT MAX(id)
                  FROM emotion_logs
                  WHERE meeting_id = ?
                  GROUP BY participant_name
              )
            ORDER BY participant_name
            """,
            (meeting_id, meeting_id),
        ).fetchall()
    return [dict(r) for r in rows]


def get_full_report(meeting_id: str) -> dict:
    """Return session info and complete emotion log for a meeting."""
    session = get_session(meeting_id)
    with _conn() as conn:
        logs = conn.execute(
            "SELECT * FROM emotion_logs WHERE meeting_id=? ORDER BY timestamp",
            (meeting_id,),
        ).fetchall()
    return {
        "session": session,
        "logs": [dict(r) for r in logs],
    }


# Initialise on import
init_db()
