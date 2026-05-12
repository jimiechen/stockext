/** Background service worker – WebSocket client for local service.
 *
 *  Responsibilities:
 *  - Read WS_TOKEN from config.json (fetched at runtime).
 *  - Maintain a WebSocket connection to ws://127.0.0.1:8765/ws/plugin.
 *  - Auto-reconnect: 3 s interval, max 10 attempts.
 *  - Send PLUGIN_CONNECTED on open.
 *  - Reply PONG to server PING.
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
    if (msg && msg.type === protocol.MSG_TYPE.PING) {
      ws.send(protocol.pong());
      logger.info("WS heartbeat pong sent");
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
  stateManager,
};

// Bootstrap
loadConfig().then(() => {
  logger.info("Background script started");
  connect();
});
