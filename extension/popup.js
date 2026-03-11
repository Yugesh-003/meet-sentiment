/**
 * popup.js
 * Reads the latest sentiment from chrome.storage and listens for live updates.
 */

function updateUI(data) {
  const { scores, label, text } = data;

  const labelEl = document.getElementById("label");
  labelEl.textContent = label;
  labelEl.className = `label-${label}`;

  const pct = (v) => Math.round(v * 100);

  document.getElementById("bar-pos").style.width = `${pct(scores.pos)}%`;
  document.getElementById("val-pos").textContent = `${pct(scores.pos)}%`;

  document.getElementById("bar-neg").style.width = `${pct(scores.neg)}%`;
  document.getElementById("val-neg").textContent = `${pct(scores.neg)}%`;

  document.getElementById("bar-neu").style.width = `${pct(scores.neu)}%`;
  document.getElementById("val-neu").textContent = `${pct(scores.neu)}%`;

  document.getElementById("status").textContent =
    `Compound: ${scores.compound.toFixed(3)}`;
  document.getElementById("caption").textContent = text || "";
}

// Load the last stored result on popup open
chrome.storage.local.get("latestSentiment", ({ latestSentiment }) => {
  if (latestSentiment) updateUI(latestSentiment);
});

// Listen for live updates from the background service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SENTIMENT_RESULT") {
    updateUI(message.payload);
  }
});
