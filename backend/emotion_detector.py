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


NEUTRAL_FALLBACK = {
    "face_id": 0,
    "bbox": {"x": 0, "y": 0, "w": 0, "h": 0},
    "dominant_emotion": "neutral",
    "emotion_scores": {k: 0.0 for k in EMOTION_KEYS},
    "confidence": 0.0,
    "fallback": True,
}


def detect_emotions(image_b64: str) -> list[dict]:
    """
    Main entry point.
    1. Decode base64 frame.
    2. Detect all faces using OpenCV Haar cascade.
    3. For each face ROI run DeepFace.analyze().
       If Haar finds nothing, run DeepFace on the whole frame as fallback.
    4. ALWAYS returns a non-empty list (neutral fallback if all else fails).
    """
    print(f"[emotion_detector] detect_emotions called, frame length: {len(image_b64)}")

    try:
        frame = decode_frame(image_b64)
        if frame is None:
            print("[emotion_detector] Frame decode failed — returning neutral fallback")
            return [dict(NEUTRAL_FALLBACK)]

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Detect faces with Haar cascade
        faces = _face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30),
        )

        print(f"[emotion_detector] Haar cascade found {len(faces)} face(s)")

        if len(faces) == 0:
            # Fallback: run DeepFace on the whole frame (handles tilted/partial faces)
            print("[emotion_detector] No faces from Haar — trying whole-frame DeepFace fallback")
            return _analyze_whole_frame(frame)

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

                print(f"[emotion_detector] Face {face_id}: {dominant} ({confidence:.2f})")
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
                print(f"[emotion_detector] DeepFace error on face {face_id}: {e} — using neutral")
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

        # Safety: should never be empty here, but guard anyway
        if not results:
            print("[emotion_detector] All faces failed — returning neutral fallback")
            return [dict(NEUTRAL_FALLBACK)]

        return results

    except Exception as top_err:
        print(f"[emotion_detector] Unexpected top-level error: {top_err} — returning neutral fallback")
        return [dict(NEUTRAL_FALLBACK)]


def _analyze_whole_frame(frame: np.ndarray) -> list[dict]:
    """Run DeepFace on the entire frame when Haar finds no faces."""
    try:
        analysis = DeepFace.analyze(
            frame,
            actions=["emotion"],
            enforce_detection=False,
            detector_backend="opencv",
            silent=True,
        )
        result = analysis[0] if isinstance(analysis, list) else analysis
        emotion_scores: dict = result.get("emotion", {})
        dominant: str = result.get("dominant_emotion", "neutral")
        scores = {k: float(emotion_scores.get(k, 0.0)) for k in EMOTION_KEYS}
        confidence = scores.get(dominant, 0.0) / 100.0
        print(f"[emotion_detector] Whole-frame fallback result: {dominant} ({confidence:.2f})")
        return [{
            "face_id": 0,
            "bbox": {"x": 0, "y": 0, "w": frame.shape[1], "h": frame.shape[0]},
            "dominant_emotion": dominant,
            "emotion_scores": scores,
            "confidence": round(confidence, 4),
            "fallback": True,
        }]
    except Exception as e:
        print(f"[emotion_detector] Whole-frame fallback also failed: {e} — returning neutral")
        return [dict(NEUTRAL_FALLBACK)]
