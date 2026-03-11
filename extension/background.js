/**
 * background.js (Service Worker — Manifest V3)
 *
 * Two parallel pipelines:
 *  1. CAPTION → WebSocket (text sentiment via content_script.js)
 *  2. VIDEO   → tabCapture → canvas frame → base64 JPEG → WebSocket (DeepFace emotion)
 */

const WS_URL = "ws://localhost:8000/ws";
const RETRY_DELAY_MS = 3000;
const FRAME_INTERVAL_MS = 4000; // Send one frame every 4 s (matches backend rate-limit)

let socket = null;
let sessionId = null;
let retryTimeout = null;

// Offscreen canvas for frame extraction (service workers have no DOM)
// We'll use a trick: send frames from a tab's MediaStream via chrome.tabCapture
let captureStream = null;
let frameIntervalId = null;

// ── Keep-alive (MV3 SW workaround) ──────────────────────────────────────────
chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "ping" }));
    } else {
      scheduleReconnect();
    }
  }
});

// ── WebSocket helpers ────────────────────────────────────────────────────────
function scheduleReconnect() {
  if (retryTimeout) return;
  retryTimeout = setTimeout(() => {
    retryTimeout = null;
    connect();
  }, RETRY_DELAY_MS);
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  try {
    socket = new WebSocket(WS_URL);
  } catch (err) {
    console.warn("[MeetSentiment] Could not create WebSocket:", err);
    scheduleReconnect();
    return;
  }

  socket.onopen = () => console.log("[MeetSentiment] WebSocket connected.");

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "connected") {
        sessionId = data.session_id;
        return;
      }
      if (data.type === "pong" || data.type === "ping") return;

      // Both caption and emotion results go to storage + popup
      if (data.type === "result_caption" || data.type === "result_emotion") {
        const key = data.type === "result_caption" ? "latestSentiment" : "latestEmotion";
        chrome.storage.local.set({ [key]: data });
        chrome.runtime.sendMessage({ type: "LIVE_UPDATE", payload: data }).catch(() => {});
      }
    } catch (e) {
      console.error("[MeetSentiment] WS parse error:", e);
    }
  };

  socket.onerror = () => console.warn("[MeetSentiment] WebSocket error — backend may be offline.");
  socket.onclose = () => {
    console.warn("[MeetSentiment] WebSocket closed. Reconnecting...");
    socket = null;
    scheduleReconnect();
  };
}

// ── tabCapture frame pipeline ─────────────────────────────────────────────────
/**
 * Start capturing the active Google Meet tab.
 * Called from the popup when user clicks "Start Capture".
 */
function startCapture(tabId) {
  if (captureStream) return; // already running

  chrome.tabCapture.capture(
    { video: true, audio: false,
      videoConstraints: { mandatory: { maxWidth: 640, maxHeight: 360, maxFrameRate: 5 } } },
    (stream) => {
      if (chrome.runtime.lastError || !stream) {
        console.error("[MeetSentiment] tabCapture failed:", chrome.runtime.lastError);
        return;
      }
      captureStream = stream;

      // Draw stream frames into an OffscreenCanvas periodically
      const video = new VideoFrame; // placeholder — can't use <video> in SW
      // We relay via a shared offscreen document instead
      chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["USER_MEDIA"],
        justification: "Capture video frame from Meet tab stream",
      }).then(() => {
        // Pass the stream to the offscreen document via a message port
        chrome.runtime.sendMessage({ type: "START_FRAME_CAPTURE", stream: null });
      }).catch((err) => {
        // Offscreen document might already exist
        chrome.runtime.sendMessage({ type: "START_FRAME_CAPTURE", stream: null });
      });
    }
  );
}

function stopCapture() {
  if (captureStream) {
    captureStream.getTracks().forEach((t) => t.stop());
    captureStream = null;
  }
  clearInterval(frameIntervalId);
  frameIntervalId = null;
}

// ── Message relay ─────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender) => {
  // Caption chunk from content_script.js
  if (message.type === "CAPTION_CHUNK") {
    if (!socket || socket.readyState !== WebSocket.OPEN) { connect(); return; }
    socket.send(JSON.stringify({ type: "caption", text: message.text, session_id: sessionId }));
  }

  // Base64 JPEG frame from offscreen document
  if (message.type === "FRAME_DATA") {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "frame", image_b64: message.image_b64, session_id: sessionId }));
  }

  // Popup requesting capture start
  if (message.type === "START_CAPTURE") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) startCapture(tab.id);
    });
  }

  if (message.type === "STOP_CAPTURE") {
    stopCapture();
  }
});

// Initial connection
connect();
