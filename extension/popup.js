/**
 * popup.js — handles both caption sentiment and facial emotion live updates
 */

const EMOTION_COLORS = {
  happy:    "#34d399",
  sad:      "#60a5fa",
  angry:    "#f87171",
  fear:     "#c084fc",
  surprise: "#fbbf24",
  neutral:  "#9ca3af",
  disgust:  "#a3e635",
};

function pct(v) { return Math.round(v * 100); }

// ── Sentiment panel ───────────────────────────────────────────────────────────
function updateSentiment(data) {
  const { scores, label, text } = data;
  const labelEl = document.getElementById("sentiment-label");
  labelEl.textContent = label;
  labelEl.className = `label-${label}`;

  document.getElementById("bar-pos").style.width = `${pct(scores.pos)}%`;
  document.getElementById("val-pos").textContent = `${pct(scores.pos)}%`;
  document.getElementById("bar-neg").style.width = `${pct(scores.neg)}%`;
  document.getElementById("val-neg").textContent = `${pct(scores.neg)}%`;
  document.getElementById("bar-neu").style.width = `${pct(scores.neu)}%`;
  document.getElementById("val-neu").textContent = `${pct(scores.neu)}%`;

  if (text) document.getElementById("caption").textContent = text;
}

// ── Emotion panel ─────────────────────────────────────────────────────────────
function updateEmotion(data) {
  if (data.skipped) return; // rate-limited frame, ignore
  const emotion = data.emotion;
  if (!emotion || emotion.error) return;

  document.getElementById("emotion-label").textContent =
    `${emojiFor(emotion.dominant_emotion)} ${emotion.dominant_emotion}`;

  const container = document.getElementById("emotion-bars");
  container.innerHTML = "";

  const scores = emotion.emotions || {};
  // Sort by score descending
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const max = sorted[0]?.[1] || 1;

  sorted.forEach(([name, score]) => {
    const width = Math.round((score / max) * 100);
    const color = EMOTION_COLORS[name.toLowerCase()] || "#9ca3af";
    const row = document.createElement("div");
    row.className = "ebar-row";
    row.innerHTML = `
      <span class="name">${name}</span>
      <div class="ebar-bg">
        <div class="ebar-fill" style="width:${width}%; background:${color};"></div>
      </div>
      <span class="val">${score.toFixed(1)}%</span>
    `;
    container.appendChild(row);
  });
}

function emojiFor(emotion) {
  const map = { happy:"😄", sad:"😢", angry:"😠", fear:"😨", surprise:"😮", neutral:"😐", disgust:"🤢" };
  return map[emotion?.toLowerCase()] || "🎭";
}

// ── Boot: load cached state ───────────────────────────────────────────────────
chrome.storage.local.get(["latestSentiment", "latestEmotion"], ({ latestSentiment, latestEmotion }) => {
  if (latestSentiment) updateSentiment(latestSentiment);
  if (latestEmotion)   updateEmotion(latestEmotion);
});

// ── Live updates from background.js ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "LIVE_UPDATE") return;
  const { payload } = message;
  if (payload.type === "result_caption") updateSentiment(payload);
  if (payload.type === "result_emotion")  updateEmotion(payload);
});

// ── Capture controls ──────────────────────────────────────────────────────────
document.getElementById("btn-start").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "START_CAPTURE" });
});
document.getElementById("btn-stop").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });
});
