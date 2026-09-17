// background.js — service worker
// Responsibilities: ensure the offscreen document exists, hand jobs to it,
// return immediately. Results travel offscreen → editor directly.

let creating = null; // in-flight createDocument promise (single wake only)

async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  if (existing.length > 0) return;

  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: "offscreen.html",
        reasons: ["WORKERS"],
        justification: "Runs the Python (Pyodide/WASM) interpreter for user scripts",
      })
      .finally(() => { creating = null; });
  }
  await creating;
}

async function waitUntilReady(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await chrome.runtime
      .sendMessage({ target: "offscreen", type: "ping" })
      .catch(() => null); // page exists but listener not registered yet
    if (res?.ready) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Pyodide failed to start");
}

// Single entry point — nothing else messages the offscreen doc.
async function sendToPython(msg) {
  await ensureOffscreen();
  await waitUntilReady();
  return chrome.runtime.sendMessage({ target: "offscreen", ...msg });
}

// ---- Listeners: top level only ----

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== "background") return;

  if (msg.type === "run") {
    const jobId = crypto.randomUUID();
    sendToPython({ type: "run", jobId, code: msg.code }).catch((e) => {
      chrome.runtime
        .sendMessage({ type: "result", jobId, error: String(e) })
        .catch(() => {});
    });
    sendResponse({ jobId });
    return true;
  }

  if (msg.type === "warm") {
    ensureOffscreen()
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ error: String(e) }));
    return true;
  }
});

chrome.runtime.onStartup.addListener(() => { ensureOffscreen().catch(() => {}); });
chrome.runtime.onInstalled.addListener(() => { ensureOffscreen().catch(() => {}); });