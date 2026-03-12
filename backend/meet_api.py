"""
meet_api.py — Google Meet API integration for MeetMind

- get_latest_conference()          → most recent conferenceRecord
- get_conference_participants(id)  → list of display names
- list_all_conferences()           → all conferenceRecords
- generate_fallback_id(code)       → roomCode_timestamp fallback

All calls have try/except — app degrades gracefully if API unavailable.
"""

import os
from datetime import datetime
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

BASE_DIR = Path(__file__).parent

SCOPES = ["https://www.googleapis.com/auth/meetings.space.readonly"]
CREDENTIALS_FILE = BASE_DIR / "credentials.json"
TOKEN_FILE       = BASE_DIR / "token.json"


def get_credentials():
    creds = None
    if TOKEN_FILE.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
        except Exception:
            creds = None

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            TOKEN_FILE.write_text(creds.to_json())
        except Exception:
            creds = None

    if not creds or not creds.valid:
        if not CREDENTIALS_FILE.exists():
            print("[MeetAPI] No credentials.json — Meet API disabled")
            return None
        try:
            flow  = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)
            TOKEN_FILE.write_text(creds.to_json())
        except Exception as e:
            print(f"[MeetAPI] OAuth failed: {e}")
            return None
    return creds


def _build_service():
    creds = get_credentials()
    if not creds:
        return None
    try:
        return build("meet", "v2", credentials=creds, cache_discovery=False)
    except Exception as e:
        print(f"[MeetAPI] Service build failed: {e}")
        return None


def get_latest_conference():
    """Return the most recently started conferenceRecord as a dict, or None."""
    svc = _build_service()
    if not svc:
        return None
    try:
        resp = svc.conferenceRecords().list(pageSize=1).execute()
        records = resp.get("conferenceRecords", [])
        if not records:
            return None
        return _parse_record(records[0])
    except HttpError as e:
        print(f"[MeetAPI] conferenceRecords.list error: {e}")
        return None


def list_all_conferences(page_size=50):
    svc = _build_service()
    if not svc:
        return []
    try:
        resp = svc.conferenceRecords().list(pageSize=page_size).execute()
        return [_parse_record(r) for r in resp.get("conferenceRecords", [])]
    except HttpError as e:
        print(f"[MeetAPI] list error: {e}")
        return []


def get_conference_participants(conference_id):
    """Return list of display names for a conference. [] on failure."""
    svc = _build_service()
    if not svc:
        return []
    try:
        resp = (
            svc.conferenceRecords()
               .participants()
               .list(parent=conference_id, pageSize=50)
               .execute()
        )
        names = []
        for p in resp.get("participants", []):
            user = p.get("signedinUser") or p.get("anonymousUser") or {}
            name = user.get("displayName", "")
            if name:
                names.append(name)
        return names
    except HttpError as e:
        print(f"[MeetAPI] participants error: {e}")
        return []


def _parse_record(rec):
    name      = rec.get("name", "")
    space     = rec.get("space", "")
    start_raw = rec.get("startTime", "")
    end_raw   = rec.get("endTime", "")

    started_at = start_raw.rstrip("Z") if start_raw else datetime.utcnow().isoformat()
    ended_at   = end_raw.rstrip("Z") if end_raw else None
    space_id   = space.split("/")[-1] if "/" in space else space

    duration = 0
    if started_at and ended_at:
        try:
            def p(s):
                for f in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
                    try: return datetime.strptime(s, f)
                    except ValueError: continue
                return datetime.utcnow()
            duration = max(0, int((p(ended_at) - p(started_at)).total_seconds()))
        except Exception:
            pass

    return {
        "conference_id":    name,
        "space_id":         space_id,
        "started_at":       started_at,
        "ended_at":         ended_at,
        "duration_seconds": duration,
    }


def generate_fallback_id(room_code=""):
    """Generate a unique ID when Meet API is unavailable: code_timestamp."""
    ts = int(datetime.utcnow().timestamp())
    code = room_code.strip().replace(" ", "-") if room_code else "local"
    return f"{code}_{ts}"
