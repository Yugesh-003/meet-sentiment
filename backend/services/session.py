from datetime import datetime
from typing import List

# In-memory session store (keyed by session_id)
_sessions: dict[str, List[dict]] = {}


def add_entry(session_id: str, text: str, scores: dict, label: str) -> dict:
    """Add a sentiment entry to the session history."""
    entry = {
        "text": text,
        "scores": scores,
        "label": label,
        "timestamp": datetime.utcnow().isoformat(),
    }
    if session_id not in _sessions:
        _sessions[session_id] = []
    _sessions[session_id].append(entry)
    return entry


def get_history(session_id: str) -> List[dict]:
    """Retrieve all entries for a given session."""
    return _sessions.get(session_id, [])


def clear_session(session_id: str):
    """Clear a session's history."""
    _sessions.pop(session_id, None)
