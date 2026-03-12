/**
 * background.js — MeetMind Service Worker (redesigned)
 *
 * Minimal role: keep-alive, relay messages, clean up on tab close.
 * Session management is now in content.js (driven by toggle).
 */

const API = 'http://localhost:8000';

// Keep-alive via alarms
chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener(() => {});

// ── Tab close: end session if capturing ──────────────────────────────────────
chrome.tabs.onRemoved.addListener(async () => {
  const meetTabs = await chrome.tabs.query({ url: 'https://meet.google.com/*' });
  if (meetTabs.length === 0) {
    const { capturing, conference_id } = await chrome.storage.local.get(['capturing', 'conference_id']);
    if (capturing && conference_id) {
      try {
        await fetch(`${API}/session/end/${encodeURIComponent(conference_id)}`, { method: 'POST' });
        console.log('[MeetMind BG] Session ended on tab close:', conference_id);
      } catch (_) {}
      await chrome.storage.local.set({ capturing: false });
    }
  }
});

// ── Message relay ────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_STATE') {
    chrome.storage.local.get(['capturing', 'conference_id', 'participant_names'], (data) => {
      sendResponse(data);
    });
    return true;
  }
});
