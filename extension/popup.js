/**
 * popup.js — MeetMind popup with toggle switch
 *
 * Toggle ON  → START_CAPTURE message to content.js → polls /live
 * Toggle OFF → STOP_CAPTURE message to content.js → stops polling
 * Only interactive when user is on meet.google.com
 */

const API = 'http://localhost:8000';
const DASHBOARD = 'http://localhost:5173';
const POLL_MS = 3000;

const EMOJI  = { happy:'😊', sad:'😢', angry:'😠', fear:'😨', surprise:'😲', neutral:'😐', disgust:'🤢' };
const COLORS = { happy:'#22c55e', sad:'#3b82f6', angry:'#ef4444', fear:'#f97316', surprise:'#a855f7', disgust:'#84cc16', neutral:'#94a3b8' };

let pollTimer = null;
let conferenceId = null;

// ── Elements ──────────────────────────────────────────────────────────────────
const elMeetingId     = document.getElementById('meeting-id');
const elNotOnMeet     = document.getElementById('not-on-meet');
const elToggleRow     = document.getElementById('toggle-row');
const elToggle        = document.getElementById('toggle');
const elToggleLabel   = document.getElementById('toggle-label');
const elList          = document.getElementById('participant-list');
const elBtnReport     = document.getElementById('btn-report');

// ── Boot ──────────────────────────────────────────────────────────────────────
(async function boot() {
  // Check if we're on a Meet tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const onMeet = tab?.url?.includes('meet.google.com/');

  if (!onMeet) {
    elNotOnMeet.style.display = 'block';
    elToggleRow.style.display = 'none';
    elList.innerHTML = '';
    return;
  }

  // On Meet — show toggle
  elNotOnMeet.style.display = 'none';
  elToggleRow.style.display = 'flex';

  // Restore state from storage
  const data = await chrome.storage.local.get(['capturing', 'conference_id']);
  conferenceId = data.conference_id || null;
  const capturing = !!data.capturing;

  elToggle.checked = capturing;
  updateToggleUI(capturing);

  if (conferenceId) {
    elMeetingId.textContent = conferenceId.split('/').pop().slice(0, 12);
  }

  if (capturing && conferenceId) {
    startPolling();
  }

  // Toggle handler
  elToggle.addEventListener('change', async () => {
    const on = elToggle.checked;
    await chrome.storage.local.set({ capturing: on });
    updateToggleUI(on);

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, { type: on ? 'START_CAPTURE' : 'STOP_CAPTURE' });
    }

    if (on) {
      // Wait a moment for content.js to call /session/start and store conference_id
      setTimeout(async () => {
        const d = await chrome.storage.local.get('conference_id');
        conferenceId = d.conference_id || null;
        if (conferenceId) {
          elMeetingId.textContent = conferenceId.split('/').pop().slice(0, 12);
        }
        startPolling();
      }, 1500);
    } else {
      stopPolling();
      elBtnReport.disabled = false; // Enable report after stopping
    }
  });

  // Report button
  elBtnReport.addEventListener('click', () => {
    if (conferenceId) {
      chrome.tabs.create({ url: `${DASHBOARD}/report/${encodeURIComponent(conferenceId)}` });
    }
  });
})();


// ── Toggle UI ─────────────────────────────────────────────────────────────────
function updateToggleUI(on) {
  if (on) {
    elToggleLabel.innerHTML = '<span class="pulse-dot"></span> Capturing...';
    elToggleLabel.style.color = '#ef4444';
  } else {
    elToggleLabel.innerHTML = '<span class="off-text">Click to start capturing</span>';
    elToggleLabel.style.color = '';
  }
}

// ── Polling ───────────────────────────────────────────────────────────────────
function startPolling() {
  if (pollTimer) return;
  poll(); // immediate first call
  pollTimer = setInterval(poll, POLL_MS);
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}

async function poll() {
  if (!conferenceId) return;
  try {
    const res = await fetch(`${API}/live/${encodeURIComponent(conferenceId)}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return;
    const data = await res.json();
    render(data.participants || []);
  } catch (_) {}
}

// ── Render ────────────────────────────────────────────────────────────────────
function render(participants) {
  if (!participants.length) {
    elList.innerHTML = '<div class="empty">Waiting for participants…</div>';
    return;
  }
  elBtnReport.disabled = false;

  elList.innerHTML = participants.map(p => {
    const emotion = (p.dominant_emotion || 'neutral').toLowerCase();
    const emoji = EMOJI[emotion] || '😐';
    const color = COLORS[emotion] || '#94a3b8';
    const conf  = Math.round((p.confidence || 0) * 100);
    const name  = p.participant_name || 'Unknown';
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
