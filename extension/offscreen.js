// offscreen.js — hosts Pyodide. Created by background.js, lives until closed.

// ---- 1. State ----
let ready = false;              // has Pyodide finished loading?
let output = [];                // stdout/stderr of the currently running script
const results = new Map();      // jobId → result, for when the editor is closed

// ---- 2. Load Pyodide once, at page load ----
const pyodideReady = loadPyodide({
  indexURL: "vendor/pyodide/",
  stdout: (s) => output.push(s),
  stderr: (s) => output.push("ERR: " + s),
}).then(async (py) => {
  await py.runPythonAsync("print('warm')");  // throwaway warm-up run
  output = [];
  ready = true;
  return py;
});

// ---- 3. Run one script ----
async function runJob(jobId, code) {
  const py = await pyodideReady;
  const globals = py.toPy({});   // fresh namespace per run
  output = [];

  let result;
  try {
    await py.runPythonAsync(code, { globals });
    result = { type: "result", jobId, output: [...output] };
  } catch (e) {
    result = { type: "result", jobId, output: [...output], error: String(e) };
  } finally {
    globals.destroy();           // free the PyProxy
  }

  results.set(jobId, result);
  if (results.size > 20) results.delete(results.keys().next().value);

  chrome.runtime.sendMessage(result).catch(() => {});  // editor may be closed
}

// ---- 4. Message handling ----
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== "offscreen") return;

  if (msg.type === "ping") {
    sendResponse({ ready });
    return;
  }

  if (msg.type === "run") {
    runJob(msg.jobId, msg.code);      // no await — don't block the response
    sendResponse({ accepted: true });
    return;
  }

  if (msg.type === "getResult") {
    sendResponse(results.get(msg.jobId) ?? null);
    return;
  }
});