/**
 * offscreen.js
 *
 * Runs in the hidden offscreen document (has full DOM access).
 * Uses getUserMedia-style stream from tabCapture to draw frames on a canvas,
 * then sends base64 JPEG back to background.js every FRAME_INTERVAL_MS.
 */

const FRAME_INTERVAL_MS = 4000; // must match backend rate limit
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let video = null;
let intervalId = null;

function startFrameLoop(stream) {
  video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.play();

  video.onloadedmetadata = () => {
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;

    intervalId = setInterval(() => {
      if (video.readyState < 2) return; // not enough data yet
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Export as JPEG, quality 0.6 to keep payload small
      const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
      const image_b64 = dataUrl.split(",")[1]; // strip "data:image/jpeg;base64,"
      chrome.runtime.sendMessage({ type: "FRAME_DATA", image_b64 });
    }, FRAME_INTERVAL_MS);
  };
}

function stopFrameLoop() {
  clearInterval(intervalId);
  intervalId = null;
  if (video) {
    video.srcObject?.getTracks().forEach((t) => t.stop());
    video = null;
  }
}

// Listen for messages from background.js
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "START_FRAME_CAPTURE") {
    // Request the tab's stream via tabCapture on behalf of background.js
    // Note: tabCapture.capture() must happen in the context of a user gesture or
    // be relayed as a MediaStream. Use getUserMedia with chromeMediaSource instead.
    chrome.tabCapture.getMediaStreamId(
      { consumerTabId: undefined }, // captures the calling tab
      (streamId) => {
        if (chrome.runtime.lastError) {
          console.error("[Offscreen] getMediaStreamId failed:", chrome.runtime.lastError);
          return;
        }
        navigator.mediaDevices
          .getUserMedia({
            video: {
              mandatory: {
                chromeMediaSource: "tab",
                chromeMediaSourceId: streamId,
                maxWidth: 640,
                maxHeight: 360,
                maxFrameRate: 5,
              },
            },
            audio: false,
          })
          .then(startFrameLoop)
          .catch((err) => console.error("[Offscreen] getUserMedia failed:", err));
      }
    );
  }

  if (message.type === "STOP_FRAME_CAPTURE") {
    stopFrameLoop();
  }
});
