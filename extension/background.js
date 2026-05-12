/** Background service worker – WebSocket client for local service.
 *
 *  Responsibilities:
 *  - Read WS_TOKEN from config.json (fetched at runtime).
 *  - Maintain a WebSocket connection to ws://127.0.0.1:8765/ws/plugin.
 *  - Auto-reconnect: 3 s interval, max 10 attempts.
 *  - Send PLUGIN_CONNECTED on open.
 *  - Reply PONG to server PING.
 *  - Forward ANALYZE_REQUEST to content script.
 *  - Forward ANALYZE_RESPONSE / ERROR back to server.
 *  - Update internal state machine on connection changes.
 */

importScripts(
  "utils/logger.js",
  "utils/state.js",
  "utils/protocol.js"
);

const WS_URL_BASE = "ws://127.0.0.1:8765/ws/plugin";
const RECONNECT_INTERVAL_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let stateManager = new StateManager();
let wsToken = "";
let currentTaskId = null;

async function loadConfig() {
  try {
    const resp = await fetch(chrome.runtime.getURL("config.json"));
    const cfg = await resp.json();
    wsToken = cfg.WS_TOKEN || "";
  } catch (err) {
    logger.error("Failed to load config.json", err);
    wsToken = "";
  }
}

function buildWsUrl() {
  const token = encodeURIComponent(wsToken);
  return `${WS_URL_BASE}?token=${token}`;
}

function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return;
  }

  stateManager.transition(WS_STATE.WS_CONNECTING);
  logger.info("WS connecting... (attempt", reconnectAttempts + 1, ")");

  try {
    ws = new WebSocket(buildWsUrl());
  } catch (err) {
    logger.error("WS constructor error", err);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    reconnectAttempts = 0;
    stateManager.transition(WS_STATE.WS_CONNECTED);
    logger.info("WS connected");
    ws.send(protocol.pluginConnected());
  };

  ws.onmessage = (event) => {
    const msg = protocol.parse(event.data);
    if (!msg) {
      logger.warn("WS received invalid JSON", event.data);
      return;
    }

    if (msg.type === protocol.MSG_TYPE.PING) {
      ws.send(protocol.pong());
      logger.info("WS heartbeat pong sent");
      return;
    }

    if (msg.type === protocol.MSG_TYPE.ANALYZE_REQUEST) {
      handleAnalyzeRequest(msg);
      return;
    }

    logger.info("WS message", event.data);
  };

  ws.onclose = () => {
    logger.warn("WS closed");
    ws = null;
    stateManager.transition(WS_STATE.WS_DISCONNECTED);
    scheduleReconnect();
  };

  ws.onerror = (err) => {
    logger.error("WS error", err);
    // onclose will fire next; do not duplicate logic here
  };
}

function scheduleReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error("Max reconnect attempts reached, giving up.");
    return;
  }
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_INTERVAL_MS);
}

function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  stateManager.transition(WS_STATE.WS_DISCONNECTED);
  reconnectAttempts = 0;
}

/**
 * Handle ANALYZE_REQUEST from server.
 * Forward to content script on DeepSeek page.
 */
async function handleAnalyzeRequest(msg) {
  const { request_id, task_id, stock_code, prompt, timeout_seconds } = msg.payload || {};
  currentTaskId = task_id;

  logger.info("Received ANALYZE_REQUEST", { request_id, task_id, stock_code });

  // Find DeepSeek tab
  const tabs = await chrome.tabs.query({ url: "https://chat.deepseek.com/*" });
  if (tabs.length === 0) {
    sendError(request_id, task_id, "DS_PAGE_NOT_FOUND", "DeepSeek page not found", true);
    return;
  }

  const tab = tabs[0];

  // Check if content script is ready
  try {
    const pingResult = await chrome.tabs.sendMessage(tab.id, { type: "PING_CONTENT" });
    if (!pingResult || pingResult.type !== "PONG_CONTENT") {
      sendError(request_id, task_id, "CONTENT_SCRIPT_NOT_READY", "Content script not responding", true);
      return;
    }
  } catch (err) {
    sendError(request_id, task_id, "CONTENT_SCRIPT_NOT_READY", "Content script not injected: " + err.message, true);
    return;
  }

  // Check page status
  try {
    const statusResult = await chrome.tabs.sendMessage(tab.id, { type: "CHECK_PAGE_STATUS" });
    if (statusResult.payload.status !== "DS_READY") {
      sendError(request_id, task_id, statusResult.payload.status, statusResult.payload.reason || statusResult.payload.status, true);
      return;
    }
  } catch (err) {
    sendError(request_id, task_id, "DS_PAGE_NOT_READY", "Failed to check page status: " + err.message, true);
    return;
  }

  // Send ANALYZE_REQUEST to content script
  try {
    const result = await chrome.tabs.sendMessage(tab.id, {
      type: "ANALYZE_REQUEST",
      payload: {
        prompt,
        taskId: task_id,
        timeoutSeconds: timeout_seconds || 180,
      },
    });

    // Forward result back to server
    if (result.type === "ERROR") {
      ws.send(protocol.error(request_id, task_id, result.payload.code, result.payload.message, result.payload.retryable));
    } else {
      ws.send(protocol.analyzeResponse(request_id, task_id, result.payload));
    }
  } catch (err) {
    sendError(request_id, task_id, "TASK_EXECUTION_FAILED", "Task execution failed: " + err.message, false);
  } finally {
    currentTaskId = null;
  }
}

function sendError(requestId, taskId, code, message, retryable) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(protocol.error(requestId, taskId, code, message, retryable));
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getStatus") {
    sendResponse({
      localStatus: stateManager.state.toLowerCase().replace("ws_", ""),
      deepseekStatus: "unknown",
      taskStatus: currentTaskId ? "executing" : "idle",
      lastError: null,
      lastDurationMs: 0,
    });
    return true;
  }
  return false;
});

// Expose for tests / debugging
self.stockExt = {
  connect,
  disconnect,
  get state() {
    return stateManager.state;
  },
  get reconnectAttempts() {
    return reconnectAttempts;
  },
  get ws() {
    return ws;
  },
  get currentTaskId() {
    return currentTaskId;
  },
  stateManager,
};

// Bootstrap
loadConfig().then(() => {
  logger.info("Background script started");
  connect();
});
