/**
 * content_script.js
 * Injected into https://meet.google.com/* tabs.
 *
 * Watches the DOM for new caption text using a MutationObserver,
 * then sends each new caption chunk to background.js via
 * chrome.runtime.sendMessage.
 *
 * Google Meet renders live captions inside elements with the attribute
 * jsname="tgaKEf" (span) inside div[jsname="YrdHyf"].
 * These selectors may change over time with Meet updates – adjust if needed.
 */

const CAPTION_SELECTOR = 'span[jsname="tgaKEf"]';
let lastSentText = "";

function sendCaption(text) {
  if (!text || text === lastSentText) return;
  lastSentText = text;
  chrome.runtime.sendMessage({ type: "CAPTION_CHUNK", text });
}

function observeCaptions() {
  const observer = new MutationObserver(() => {
    const captionEls = document.querySelectorAll(CAPTION_SELECTOR);
    captionEls.forEach((el) => {
      const text = el.textContent.trim();
      if (text) sendCaption(text);
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  console.log("[MeetSentiment] Caption observer started.");
}

// Start observing once the page is ready
if (document.readyState === "complete") {
  observeCaptions();
} else {
  window.addEventListener("load", observeCaptions);
}
