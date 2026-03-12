"""
emotion_detector.py — OpenCV + DeepFace pipeline adapted from:
https://github.com/manish-9245/Facial-Emotion-Recognition-using-OpenCV-and-Deepface

Accepts base64 JPEG frames instead of webcam input.
Detects all faces using Haar cascade, runs DeepFace per face ROI.
"""

import base64
import cv2
import numpy as np
from deepface import DeepFace

# Load Haar cascade for face detection (bundled with opencv)
_face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

EMOTION_KEYS = ["happy", "sad", "angry", "fear", "surprise", "disgust", "neutral"]


def decode_frame(image_b64: str) -> np.ndarray | None:
    """Decode a base64 JPEG string to a BGR numpy array."""
    try:
        img_bytes = base64.b64decode(image_b64)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return frame
    except Exception:
        return None


def detect_emotions(image_b64: str) -> list[dict]:
    """
    Main entry point.
    1. Decode base64 frame.
    2. Detect all faces using OpenCV Haar cascade.
    3. For each face ROI run DeepFace.analyze().
    4. Return list of per-face results.

    Returns [] if no faces found or frame is invalid.
    """
    frame = decode_frame(image_b64)
    if frame is None:
        return []

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Detect faces
    faces = _face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30),
    )

    if len(faces) == 0:
        return []

    results = []
    for face_id, (x, y, w, h) in enumerate(faces):
        face_roi = frame[y : y + h, x : x + w]

        try:
            analysis = DeepFace.analyze(
                face_roi,
                actions=["emotion"],
                enforce_detection=False,    # never crash on partial faces
                detector_backend="opencv",  # fast, consistent
                silent=True,
            )

            # DeepFace may return list or dict
            result = analysis[0] if isinstance(analysis, list) else analysis

            emotion_scores: dict = result.get("emotion", {})
            dominant: str = result.get("dominant_emotion", "neutral")

            # Normalise all emotion keys, defaulting missing to 0
            scores = {k: float(emotion_scores.get(k, 0.0)) for k in EMOTION_KEYS}

            # Confidence = score of dominant emotion / 100 (DeepFace returns %)
            confidence = scores.get(dominant, 0.0) / 100.0

            results.append(
                {
                    "face_id": face_id,
                    "bbox": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
                    "dominant_emotion": dominant,
                    "emotion_scores": scores,
                    "confidence": round(confidence, 4),
                }
            )

        except Exception as e:
            # Skip this face if DeepFace fails (partial, blurry, etc.)
            results.append(
                {
                    "face_id": face_id,
                    "bbox": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
                    "dominant_emotion": "neutral",
                    "emotion_scores": {k: 0.0 for k in EMOTION_KEYS},
                    "confidence": 0.0,
                    "error": str(e),
                }
            )

    return results
