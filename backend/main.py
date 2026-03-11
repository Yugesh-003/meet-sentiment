import json
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.sentiment import analyze, classify
from services.session import add_entry, get_history, clear_session

app = FastAPI(title="Meet Sentiment API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST endpoints ───────────────────────────────────────────────────────────

class SentimentRequest(BaseModel):
    text: str
    session_id: str | None = None


@app.get("/")
async def root():
    return {"message": "Meet Sentiment API"}


@app.post("/analyze")
async def analyze_sentiment(request: SentimentRequest):
    """One-shot REST sentiment analysis."""
    scores = analyze(request.text)
    label = classify(scores)
    entry = None
    if request.session_id:
        entry = add_entry(request.session_id, request.text, scores, label)
    return {"text": request.text, "sentiment": scores, "label": label, "entry": entry}


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get full sentiment history for a session."""
    return {"session_id": session_id, "history": get_history(session_id)}


@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Clear a session's data."""
    clear_session(session_id)
    return {"message": f"Session {session_id} cleared."}


# ── WebSocket endpoint (real-time) ────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket for real-time sentiment from caption chunks.

    Expected message format (JSON):
        { "text": "...", "session_id": "..." }

    Response format (JSON):
        { "text": "...", "sentiment": {...}, "label": "...", "timestamp": "..." }
    """
    await websocket.accept()
    session_id = str(uuid.uuid4())
    await websocket.send_json({"type": "connected", "session_id": session_id})

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            text = data.get("text", "").strip()
            if not text:
                continue

            # Use the session_id provided by the client, or the one assigned at connect
            sid = data.get("session_id", session_id)

            scores = analyze(text)
            label = classify(scores)
            entry = add_entry(sid, text, scores, label)

            await websocket.send_json({"type": "result", **entry})

    except WebSocketDisconnect:
        pass
