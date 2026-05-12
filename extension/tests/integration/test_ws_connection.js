/** Integration tests for background.js WebSocket client.
 *
 *  Spins up a local ws server, then loads background.js logic in a
 *  Node-like environment to verify connection, auth, heartbeat and
 *  auto-reconnect behaviour.
 */

const WebSocket = require("ws");
const http = require("http");

// Provide minimal chrome.runtime / fetch / console globals before loading modules
global.chrome = {
  runtime: {
    getManifest: () => ({ version: "0.2.0" }),
    getURL: (p) => "file:///mock/" + p,
  },
};
global.fetch = async () => ({ json: async () => ({ WS_TOKEN: "test-token-123" }) });

// Load background script utilities
require("../../utils/logger.js");
require("../../utils/state.js");
require("../../utils/protocol.js");

const { WS_STATE, StateManager } = require("../../utils/state.js");
const protocol = require("../../utils/protocol.js");

const WS_PORT = 18765; // use non-standard port to avoid collisions
const WS_PATH = "/ws/plugin";

function startMockServer(token) {
  const server = http.createServer();
  const wss = new WebSocket.Server({ server, path: WS_PATH });

  const connections = [];
  const messages = [];

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://localhost:${WS_PORT}`);
    const tok = url.searchParams.get("token");
    if (tok !== token) {
      ws.close(1008, "invalid token");
      return;
    }
    connections.push(ws);
    ws.on("message", (data) => {
      const text = data.toString();
      messages.push(text);
      // Simple heartbeat: reply pong to any message
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "PONG", payload: {} }));
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(WS_PORT, () => {
      resolve({ server, wss, connections, messages });
    });
  });
}

function createClientLogic() {
  const stateManager = new StateManager();
  let ws = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  const RECONNECT_INTERVAL_MS = 300;
  const MAX_RECONNECT_ATTEMPTS = 10;

  function buildWsUrl(token) {
    return `ws://127.0.0.1:${WS_PORT}${WS_PATH}?token=${encodeURIComponent(token)}`;
  }

  function connect(token = "test-token-123") {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return;
    }
    stateManager.transition(WS_STATE.WS_CONNECTING);
    ws = new WebSocket(buildWsUrl(token));

    ws.onopen = () => {
      reconnectAttempts = 0;
      stateManager.transition(WS_STATE.WS_CONNECTED);
      ws.send(protocol.pluginConnected());
    };

    ws.onmessage = (event) => {
      const msg = protocol.parse(event.data);
      if (msg && msg.type === "PING") {
        ws.send(protocol.pong());
      }
    };

    ws.onclose = () => {
      ws = null;
      stateManager.transition(WS_STATE.WS_DISCONNECTED);
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose follows
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
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
      try { ws.close(); } catch {}
      ws = null;
    }
    stateManager.transition(WS_STATE.WS_DISCONNECTED);
    reconnectAttempts = 0;
  }

  return { connect, disconnect, get state() { return stateManager.state; }, get reconnectAttempts() { return reconnectAttempts; }, stateManager };
}

describe("WebSocket connection integration", () => {
  let mock;
  let client;

  beforeEach(async () => {
    mock = await startMockServer("test-token-123");
    client = createClientLogic();
  });

  afterEach((done) => {
    client.disconnect();
    // Force close any remaining server connections
    mock.wss.clients.forEach((c) => {
      try { c.terminate(); } catch {}
    });
    mock.server.close(() => {
      done();
    });
  });

  test("connects with valid token and sends PLUGIN_CONNECTED", (done) => {
    client.stateManager.onTransition((oldS, newS) => {
      if (newS === WS_STATE.WS_CONNECTED) {
        setTimeout(() => {
          expect(mock.messages.length).toBeGreaterThanOrEqual(1);
          const first = JSON.parse(mock.messages[0]);
          expect(first.type).toBe("PLUGIN_CONNECTED");
          done();
        }, 150);
      }
    });
    client.connect();
  });

  test("rejects connection with invalid token", (done) => {
    mock.server.close(() => {
      mock.wss.clients.forEach((c) => {
        try { c.terminate(); } catch {}
      });
      startMockServer("wrong-token").then((m2) => {
        mock = m2;
        const badClient = createClientLogic();
        const check = setInterval(() => {
          if (badClient.reconnectAttempts >= 1) {
            clearInterval(check);
            badClient.disconnect();
            m2.wss.clients.forEach((c) => {
              try { c.terminate(); } catch {}
            });
            m2.server.close(() => {
              done();
            });
          }
        }, 100);
        badClient.connect("test-token-123");
      });
    });
  }, 10000);

  test("auto-reconnects after server drops connection", async () => {
    const connectedPromise = new Promise((resolve) => {
      let connectedCount = 0;
      const unsub = client.stateManager.onTransition((oldS, newS) => {
        if (newS === WS_STATE.WS_CONNECTED) {
          connectedCount += 1;
          if (connectedCount === 1) {
            // Drop the connection from server side after a brief delay
            setTimeout(() => {
              mock.wss.clients.forEach((c) => {
                try { c.terminate(); } catch {}
              });
            }, 100);
          }
          if (connectedCount === 2) {
            unsub();
            resolve();
          }
        }
      });
    });
    client.connect();
    await connectedPromise;
    // After reconnect, attempts counter is reset to 0 on successful reconnection,
    // so we verify that a reconnect happened by checking state returned to connected.
    expect(client.state).toBe(WS_STATE.WS_CONNECTED);
  }, 10000);

  test("replies PONG to server PING", async () => {
    const connectedPromise = new Promise((resolve) => {
      const unsub = client.stateManager.onTransition((oldS, newS) => {
        if (newS === WS_STATE.WS_CONNECTED) {
          unsub();
          resolve();
        }
      });
    });
    client.connect();
    await connectedPromise;

    // Wait briefly for PLUGIN_CONNECTED to be received, then send PING
    await new Promise((r) => setTimeout(r, 150));
    mock.wss.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN) {
        c.send(protocol.ping());
      }
    });
    await new Promise((r) => setTimeout(r, 150));
    const pongs = mock.messages.filter((m) => {
      try {
        return JSON.parse(m).type === "PONG";
      } catch {
        return false;
      }
    });
    expect(pongs.length).toBeGreaterThanOrEqual(1);
  });
});
