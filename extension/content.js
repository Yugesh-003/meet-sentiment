/**
 * content.js — MeetMind frame capture (toggle-controlled)
 *
 * Does NOTHING until it receives { type: 'START_CAPTURE' } from popup.
 * On START_CAPTURE: calls /session/start, stores conference_id, begins interval.
 * On STOP_CAPTURE or page unload: clears interval, calls /session/end.
 * Filters out self-preview video tile (smallest video or data-self-name).
 * 
 * ONLY activates on actual Google Meet call URLs (not landing pages).
 */

const API = 'http://localhost:8000';
const FRAME_INTERVAL_MS = 3000;
const CANVAS_W = 320;
const CANVAS_H = 240;

let conferenceId     = null;
let participantNames = [];
let captureTimer     = null;
let capturing        = false;

// ── Meeting URL detection ────────────────────────────────────────────────────
function isInActiveMeeting() {
  const path = window.location.pathname;
  return /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(path);
}

const canvas = document.createElement('canvas');
canvas.width  = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// ── Boot: restore state (in case page refreshes while capturing) ─────────────
chrome.storage.local.get(['capturing', 'conference_id', 'participant_names'], (data) => {
  // Only proceed if we're in an actual meeting
  if (!isInActiveMeeting()) {
    console.log('[MeetMind] Not in active meeting, skipping boot');
    return;
  }

  conferenceId     = data.conference_id || null;
  participantNames = data.participant_names || [];
  capturing        = !!data.capturing;
  console.log('[MeetMind] content.js loaded | capturing:', capturing, '| conf:', conferenceId);
  if (capturing && conferenceId) {
    startCaptureLoop();
  }
});

// ── Message listener from popup ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log('[MeetMind] Got message:', msg.type);

  // Only process capture messages if in active meeting
  if (!isInActiveMeeting()) {
    console.log('[MeetMind] Ignoring message - not in active meeting');
    sendResponse({ ok: false, error: 'Not in active meeting' });
    return true;
  }

  if (msg.type === 'START_CAPTURE') {
    handleStartCapture().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'STOP_CAPTURE') {
    handleStopCapture().then(() => sendResponse({ ok: true }));
    return true;
  }
});

// ── Start capture ────────────────────────────────────────────────────────────
async function handleStartCapture() {
  console.log('[MeetMind] Starting capture...');
  capturing = true;

  // Extract room code from URL for fallback ID
  const roomMatch = location.pathname.match(/\/([a-z]+-[a-z]+-[a-z]+)/i);
  const roomCode  = roomMatch ? roomMatch[1] : '';

  // Call backend to start session → get unique conference_id
  try {
    const res = await fetch(`${API}/session/start?room_code=${encodeURIComponent(roomCode)}`, {
      method: 'POST',
    });
    const data = await res.json();
    conferenceId     = data.conference_id || data.meeting_id;
    participantNames = data.participant_names || [];
    console.log('[MeetMind] Session started:', conferenceId, '| participants:', participantNames);
  } catch (err) {
    // Fallback ID if backend is down
    conferenceId = `${roomCode || 'local'}_${Date.now()}`;
    console.warn('[MeetMind] Backend down, using fallback ID:', conferenceId);
  }

  // Persist to storage so popup + page refresh can resume
  await chrome.storage.local.set({
    capturing: true,
    conference_id: conferenceId,
    participant_names: participantNames,
  });

  startCaptureLoop();
}

// ── Stop capture ─────────────────────────────────────────────────────────────
async function handleStopCapture() {
  console.log('[MeetMind] Stopping capture | conferenceId:', conferenceId);
  capturing = false;
  clearInterval(captureTimer);
  captureTimer = null;

  // End session on backend
  if (conferenceId) {
    console.log('[MeetMind] Calling POST /session/end for:', conferenceId);
    try {
      const res = await fetch(`${API}/session/end/${encodeURIComponent(conferenceId)}`, { method: 'POST' });
      if (res.ok) {
        console.log('[MeetMind] Session ended successfully:', conferenceId);
      } else {
        console.warn('[MeetMind] Session end returned status:', res.status, 'for:', conferenceId);
      }
    } catch (err) {
      console.warn('[MeetMind] Could not end session:', err.message);
    }
  } else {
    console.warn('[MeetMind] handleStopCapture: conferenceId is null — session/end skipped');
  }

  await chrome.storage.local.set({ capturing: false });
}

// ── Capture loop ─────────────────────────────────────────────────────────────
function startCaptureLoop() {
  if (captureTimer) return;
  console.log('[MeetMind] Capture loop started');
  captureTimer = setInterval(captureAndSend, FRAME_INTERVAL_MS);
}

async function captureAndSend() {
  if (!capturing || !conferenceId) return;

  const liveVideos = findLiveVideos();
  if (!liveVideos.length) {
    console.log('[MeetMind] No live videos found this tick');
    return;
  }

  for (let i = 0; i < liveVideos.length; i++) {
    const { video } = liveVideos[i];
    try {
      ctx.drawImage(video, 0, 0, CANVAS_W, CANVAS_H);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      const frame   = dataUrl.split(',')[1];
      if (!frame || frame.length < 100) continue;

      const name = resolveParticipantName(video, i);
      console.log(`[MeetMind] Frame[${i}] → "${name}" (${frame.length} chars)`);

      const res = await fetch(`${API}/analyze/frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frame,
          participant_name: name,
          meeting_id: conferenceId,
          face_index: i,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        console.log('[MeetMind] Result:', data.faces?.map(f => f.dominant_emotion));
      }
    } catch (err) {
      console.warn('[MeetMind] Frame error:', err.message);
    }
  }
}

// ── Video discovery (with self-preview filter) ───────────────────────────────
function findLiveVideos() {
  const all = [];

  document.querySelectorAll('video').forEach(v => {
    if (isLive(v) && !isSelfPreview(v)) {
      all.push({ video: v, area: v.videoWidth * v.videoHeight });
    }
  });

  // Also try iframes
  try {
    document.querySelectorAll('iframe').forEach(iframe => {
      try {
        const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iDoc) return;
        iDoc.querySelectorAll('video').forEach(v => {
          if (isLive(v) && !isSelfPreview(v)) {
            all.push({ video: v, area: v.videoWidth * v.videoHeight });
          }
        });
      } catch (_) {}
    });
  } catch (_) {}

  console.log(`[MeetMind] Found ${all.length} live video(s) (self-preview filtered)`);
  return all;
}

function isLive(video) {
  return video.videoWidth > 0 && video.readyState >= 2 && !video.paused && video.srcObject !== null;
}

/**
 * Detect self-preview video tile:
 * - Parent has [data-self-name] or [data-is-self="true"]
 * - Or: it's the smallest video when there are 2+ videos
 */
function isSelfPreview(video) {
  let el = video;
  for (let i = 0; i < 8; i++) {
    el = el?.parentElement;
    if (!el) break;
    if (el.hasAttribute('data-self-name')) return true;
    if (el.getAttribute('data-is-self') === 'true') return true;
    if (el.classList.contains('self-preview')) return true;
    if (el.hasAttribute('data-requested-by-user')) return true;
  }
  return false;
}

// ── Participant name resolution ──────────────────────────────────────────────
function resolveParticipantName(video, index) {
  const domName = extractNameFromDom(video);
  if (domName && domName.length > 1) return domName;
  if (participantNames.length > index) return participantNames[index];
  return `Participant_${index + 1}`;
}

function extractNameFromDom(video) {
  const TILE = ['[data-participant-id]', '[data-ssrc]', '[jsname="R3O5Md"]'];
  const NAME = ['[jsname="ZCMSFb"]', '.zWGUib', '.NZp2ef', '[data-self-name]'];
  let el = video;
  for (let i = 0; i < 8; i++) {
    el = el?.parentElement;
    if (!el) break;
    for (const ts of TILE) {
      if (el.matches?.(ts)) {
        for (const ns of NAME) {
          const nameEl = el.querySelector(ns);
          const t = nameEl?.textContent?.trim() || nameEl?.getAttribute('aria-label')?.trim();
          if (t) return t;
        }
      }
    }
  }
  return video.getAttribute('aria-label')?.trim() || '';
}

// ── Cleanup on page unload ───────────────────────────────────────────────────
window.addEventListener('beforeunload', () => {
  if (capturing && conferenceId) {
    console.log('[MeetMind] beforeunload: sending session/end beacon for', conferenceId);
    // Best-effort session end — navigator.sendBeacon for reliability
    navigator.sendBeacon(
      `${API}/session/end/${encodeURIComponent(conferenceId)}`,
      new Blob([], { type: 'application/json' })
    );
  } else {
    console.log('[MeetMind] beforeunload: capturing=', capturing, 'conferenceId=', conferenceId, '— no beacon sent');
  }
});

// ── Visibility change ────────────────────────────────────────────────────────
document.addEventListener('visibilitychange', () => {
  if (!capturing) return;
  if (document.hidden) {
    clearInterval(captureTimer);
    captureTimer = null;
  } else {
    startCaptureLoop();
  }
});

// ── Watch for URL changes (SPA navigation) ───────────────────────────────────
new MutationObserver(() => {
  const inMeeting = isInActiveMeeting();
  if (inMeeting && !captureTimer && capturing) {
    // Navigated into a meeting while capturing was active
    console.log('[MeetMind] SPA nav: navigated INTO meeting, resuming capture loop');
    startCaptureLoop();
  } else if (!inMeeting && captureTimer) {
    // Navigated AWAY from the meeting — stop capture AND end the session
    console.log('[MeetMind] SPA nav: navigated AWAY from meeting | conferenceId:', conferenceId);
    handleStopCapture();
  }
}).observe(document, { subtree: true, childList: true });
