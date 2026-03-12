/**
 * popup.js — MeetMind popup with toggle switch
 *
 * Toggle ON  → START_CAPTURE message to content.js → polls /live
 * Toggle OFF → STOP_CAPTURE message to content.js → stops polling
 * Only interactive when user is on an actual Google Meet call
 */

const API       = 'http://localhost:8000';
const DASHBOARD = 'http://localhost:5173';
const POLL_MS   = 3000;

const EMOJI  = { happy:'😊', sad:'😢', angry:'😠', fear:'😨', surprise:'😲', neutral:'😐', disgust:'🤢' };
const COLORS = { happy:'#22c55e', sad:'#3b82f6', angry:'#ef4444', fear:'#f97316', surprise:'#a855f7', disgust:'#84cc16', neutral:'#94a3b8' };

let pollTimer    = null;
let conferenceId = null;

// ── Elements ──────────────────────────────────────────────────────────────────
const elMeetingId   = document.getElementById('meeting-id');
const elNotOnMeet   = document.getElementById('not-on-meet');
const elToggleRow   = document.getElementById('toggle-row');
const elToggle      = document.getElementById('toggle');
const elToggleLabel = document.getElementById('toggle-label');
const elList        = document.getElementById('participant-list');
const elBtnReport   = document.getElementById('btn-report');

// ── Meeting URL check (mirrors content.js) ────────────────────────────────────
function isMeetingUrl(url) {
  return /meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(url);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
(async function boot() {
  // Detect whether the active tab is an actual Google Meet call
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url   = tab?.url || '';

  if (!isMeetingUrl(url)) {
    // Not in a real meeting — show placeholder, disable toggle
    if (elNotOnMeet)   elNotOnMeet.style.display  = 'block';
    if (elToggleRow)   elToggleRow.style.display   = 'none';
    if (elList)        elList.innerHTML             = '';
    if (elBtnReport)   elBtnReport.disabled         = true;
    if (elToggle) {
      elToggle.disabled = true;
      elToggle.checked  = false;
    }
    if (elToggleLabel) {
      elToggleLabel.innerHTML = '<span class="off-text">Join a Google Meet call to start capturing</span>';
    }
    return;
  }

  // On an actual Meet call — show toggle UI
  if (elNotOnMeet) elNotOnMeet.style.display = 'none';
  if (elToggleRow) elToggleRow.style.display = 'flex';

  // Restore state from storage
  const data     = await chrome.storage.local.get(['capturing', 'conference_id', 'participant_names']);
  const capturing = !!data.capturing;
  conferenceId    = data.conference_id || null;

  if (elToggle) elToggle.checked = capturing;
  updateToggleUI(capturing);

  if (conferenceId && elMeetingId) {
    elMeetingId.textContent = conferenceId.slice(0, 12);
  }

  if (capturing && conferenceId) {
    startPolling();
  }

  // ── Toggle handler ──────────────────────────────────────────────────────────
  if (elToggle) {
    elToggle.addEventListener('change', async () => {
      const on = elToggle.checked;

      await chrome.storage.local.set({ capturing: on });
      updateToggleUI(on);

      // Send message to content.js
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) {
        chrome.tabs.sendMessage(activeTab.id, { type: on ? 'START_CAPTURE' : 'STOP_CAPTURE' });
      }

      if (on) {
        // Wait briefly for content.js to start session and store conference_id
        setTimeout(async () => {
          const d = await chrome.storage.local.get(['conference_id']);
          conferenceId = d.conference_id || null;
          console.log('[MeetMind popup] conferenceId after START_CAPTURE:', conferenceId);
          if (conferenceId && elMeetingId) {
            elMeetingId.textContent = conferenceId.slice(0, 12);
          }
          if (!conferenceId) {
            console.warn('[MeetMind popup] conferenceId is null — cannot start polling yet');
            if (elList) elList.innerHTML = '<div class="empty">⚠️ Could not get meeting ID — try toggling off and on again.</div>';
            return;
          }
          startPolling();
        }, 150);
      } else {
        stopPolling();
        if (elList) elList.innerHTML = '';
      }
    });
  }

  // ── Report button ───────────────────────────────────────────────────────────
  if (elBtnReport) {
    elBtnReport.addEventListener('click', () => {
      if (conferenceId) {
        chrome.tabs.create({ url: `${DASHBOARD}/history/${encodeURIComponent(conferenceId)}` });
      }
    });
  }
})();


// ── Toggle UI ─────────────────────────────────────────────────────────────────
function updateToggleUI(on) {
  if (!elToggleLabel) return;
  if (on) {
    elToggleLabel.innerHTML   = '<span class="pulse-dot"></span> Capturing...';
    elToggleLabel.style.color = '#ef4444';
  } else {
    elToggleLabel.innerHTML   = '<span class="off-text">Click to start capturing</span>';
    elToggleLabel.style.color = '';
  }
}

// ── Polling ───────────────────────────────────────────────────────────────────
function startPolling() {
  if (pollTimer) return;
  if (!conferenceId) {
    console.warn('[MeetMind popup] startPolling called but conferenceId is null — aborting');
    if (elList) elList.innerHTML = '<div class="empty">⚠️ No meeting ID found. Toggle off/on to retry.</div>';
    return;
  }
  console.log('[MeetMind popup] Starting poll for conferenceId:', conferenceId);
  poll(); // immediate first call
  pollTimer = setInterval(poll, POLL_MS);
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}

async function poll() {
  if (!conferenceId) {
    console.warn('[MeetMind popup] poll() skipped — conferenceId is null');
    return;
  }
  console.log('[MeetMind popup] Polling /live/ with ID:', conferenceId);
  try {
    const res = await fetch(`${API}/live/${encodeURIComponent(conferenceId)}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      console.warn('[MeetMind popup] /live/ returned', res.status);
      return;
    }
    const data = await res.json();
    console.log('[MeetMind popup] /live/ response:', data.participants?.length, 'participant(s)');
    render(data.participants || []);
  } catch (err) {
    console.warn('[MeetMind popup] /live/ fetch error:', err.message);
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
function render(participants) {
  if (!elList) return;
  if (!participants.length) {
    elList.innerHTML = '<div class="empty">Waiting for participants…</div>';
    return;
  }
  if (elBtnReport) elBtnReport.disabled = false;

  elList.innerHTML = participants.map(p => {
    const emotion = (p.dominant_emotion || 'neutral').toLowerCase();
    const emoji   = EMOJI[emotion]  || '😐';
    const color   = COLORS[emotion] || '#94a3b8';
    const conf    = Math.round((p.confidence || 0) * 100);
    const name    = p.participant_name || 'Unknown';
    return `
      <div class="card">
        <span class="emoji">${emoji}</span>
        <div class="info">
          <div class="name" title="${name}">${name}</div>
          <div class="emotion-row">
            <span class="emotion-label" style="color:${color}">${emotion}</span>
            <span class="conf">${conf}%</span>
          </div>
          <div class="bar-bg"><div class="bar-fill" style="width:${conf}%;background:${color}"></div></div>
        </div>
      </div>`;
  }).join('');
}

window.addEventListener('unload', stopPolling);
