/**
 * background.js (Service Worker — Manifest V3)
 *
 * Maintains a WebSocket connection to the FastAPI backend.
 * Uses an alarm-based keepAlive to prevent MV3 SW termination.
 */

const WS_URL = "ws://localhost:8000/ws";
const RETRY_DELAY_MS = 3000;

let socket = null;
let sessionId = null;
let retryTimeout = null;

// ── Keep the service worker alive (MV3 workaround) ──────────────────────────
chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    // Ping the socket to keep the service alive
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "ping" }));
    } else {
      scheduleReconnect();
    }
  }
});

// ── WebSocket helpers ────────────────────────────────────────────────────────
function scheduleReconnect() {
  if (retryTimeout) return; // already scheduled
  retryTimeout = setTimeout(() => {
    retryTimeout = null;
    connect();
  }, RETRY_DELAY_MS);
}

function connect() {
  // If already connected or connecting, do nothing
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

  socket.onopen = () => {
    console.log("[MeetSentiment] WebSocket connected.");
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "connected") {
        sessionId = data.session_id;
        console.log("[MeetSentiment] Session ID:", sessionId);
        return;
      }

      if (data.type === "pong" || data.type === "ping") return;

      if (data.type === "result") {
        // Persist latest result so the popup can read it even when closed
        chrome.storage.local.set({ latestSentiment: data });
        // Broadcast to popup if open (ignore error if popup isn't open)
        chrome.runtime.sendMessage({ type: "SENTIMENT_RESULT", payload: data }).catch(() => {});
      }
    } catch (e) {
      console.error("[MeetSentiment] Error parsing WS message:", e);
    }
  };

  socket.onerror = () => {
    // Errors are logged as warnings; onclose will handle the retry
    console.warn("[MeetSentiment] WebSocket error — backend may not be running.");
  };

  socket.onclose = () => {
    console.warn("[MeetSentiment] WebSocket closed. Reconnecting in", RETRY_DELAY_MS, "ms...");
    socket = null;
    scheduleReconnect();
  };
}

// Initial connection attempt
connect();

// ── Message relay from content_script.js ─────────────────────────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "CAPTION_CHUNK") return;
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    connect(); // try to reconnect if called while disconnected
    return;
  }
  socket.send(JSON.stringify({ text: message.text, session_id: sessionId }));
});
