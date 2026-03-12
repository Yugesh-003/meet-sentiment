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
chrome.tabs.onRemoved.addListener(async (tabId) => {
  console.log('[MeetMind BG] Tab removed:', tabId);
  const meetTabs = await chrome.tabs.query({ url: 'https://meet.google.com/*' });
  console.log('[MeetMind BG] Remaining Meet tabs:', meetTabs.length);

  if (meetTabs.length === 0) {
    const { capturing, conference_id } = await chrome.storage.local.get(['capturing', 'conference_id']);
    console.log('[MeetMind BG] After last Meet tab closed | capturing:', capturing, '| conference_id:', conference_id);

    if (capturing && conference_id) {
      console.log('[MeetMind BG] Calling POST /session/end for:', conference_id);
      try {
        const res = await fetch(`${API}/session/end/${encodeURIComponent(conference_id)}`, { method: 'POST' });
        if (res.ok) {
          console.log('[MeetMind BG] Session ended on tab close:', conference_id);
        } else {
          console.warn('[MeetMind BG] Session end returned status:', res.status, 'for:', conference_id);
        }
      } catch (err) {
        console.warn('[MeetMind BG] Session end FAILED:', err.message);
      }
      await chrome.storage.local.set({ capturing: false });
      console.log('[MeetMind BG] Storage cleared: capturing=false');
    } else {
      console.log('[MeetMind BG] No active session to end (capturing:', capturing, ')');
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
