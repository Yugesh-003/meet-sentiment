import base64
import time
import numpy as np
import cv2
from deepface import DeepFace

# Rate-limiting: only analyze one frame every N seconds
ANALYSIS_INTERVAL_SEC = 4
_last_analysis_time: float = 0.0


def analyze_frame(image_b64: str) -> dict | None:
    """
    Decode a base64 JPEG frame, run DeepFace emotion analysis,
    and return the dominant emotion + full scores.
    Returns None if called too soon or if analysis fails.
    """
    global _last_analysis_time
    now = time.monotonic()

    # Rate-limit: skip if last analysis was < ANALYSIS_INTERVAL_SEC ago
    if now - _last_analysis_time < ANALYSIS_INTERVAL_SEC:
        return None

    _last_analysis_time = now

    try:
        # Decode base64 → numpy image array
        img_bytes = base64.b64decode(image_b64)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

        if frame is None:
            return None

        # Run DeepFace – enforce_detection=False skips frames with no clear face
        results = DeepFace.analyze(
            frame,
            actions=["emotion"],
            enforce_detection=False,
            silent=True,
        )

        # DeepFace returns a list; take the first (dominant) face
        result = results[0] if isinstance(results, list) else results

        return {
            "dominant_emotion": result.get("dominant_emotion"),
            "emotions": result.get("emotion"),  # all scores
        }

    except Exception as e:
        # Don't crash the server on bad frames
        return {"error": str(e)}
