import json
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.sentiment import analyze, classify
from services.session import add_entry, get_history, clear_session
from services.emotion import analyze_frame

app = FastAPI(title="Meet Sentiment API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST endpoints ────────────────────────────────────────────────────────────

class SentimentRequest(BaseModel):
    text: str
    session_id: str | None = None


class FrameRequest(BaseModel):
    image_b64: str          # base64-encoded JPEG from the extension
    session_id: str | None = None


@app.get("/")
async def root():
    return {"message": "Meet Sentiment API"}


@app.post("/analyze")
async def analyze_sentiment(request: SentimentRequest):
    """One-shot REST text sentiment analysis."""
    scores = analyze(request.text)
    label = classify(scores)
    entry = None
    if request.session_id:
        entry = add_entry(request.session_id, request.text, scores, label)
    return {"text": request.text, "sentiment": scores, "label": label, "entry": entry}


@app.post("/analyze-frame")
async def analyze_emotion_frame(request: FrameRequest):
    """
    One-shot REST facial emotion analysis.
    Accepts a base64-encoded JPEG frame, returns dominant emotion + scores.
    Returns 204-style empty body if the rate-limit skips the frame.
    """
    result = analyze_frame(request.image_b64)
    if result is None:
        return {"skipped": True, "reason": "rate_limited"}
    return {"emotion": result, "session_id": request.session_id}


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    return {"session_id": session_id, "history": get_history(session_id)}


@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    clear_session(session_id)
    return {"message": f"Session {session_id} cleared."}


# ── WebSocket endpoint (real-time captions + frames) ─────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Accepts two types of JSON messages over one WebSocket:

    Caption chunk:
        { "type": "caption", "text": "...", "session_id": "..." }

    Video frame:
        { "type": "frame", "image_b64": "...", "session_id": "..." }

    Responses:
        { "type": "result_caption", "label": "...", "scores": {...}, ... }
        { "type": "result_emotion", "dominant_emotion": "...", "emotions": {...} }
        { "type": "result_emotion", "skipped": true }   ← rate-limited
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

            msg_type = data.get("type", "caption")
            sid = data.get("session_id", session_id)

            # ── Caption analysis ──────────────────────────────────────────────
            if msg_type == "caption":
                text = data.get("text", "").strip()
                if not text:
                    continue
                scores = analyze(text)
                label = classify(scores)
                entry = add_entry(sid, text, scores, label)
                await websocket.send_json({"type": "result_caption", **entry})

            # ── Frame / emotion analysis ──────────────────────────────────────
            elif msg_type == "frame":
                image_b64 = data.get("image_b64", "")
                if not image_b64:
                    continue
                result = analyze_frame(image_b64)
                if result is None:
                    await websocket.send_json({"type": "result_emotion", "skipped": True})
                else:
                    await websocket.send_json({"type": "result_emotion", "emotion": result, "session_id": sid})

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
