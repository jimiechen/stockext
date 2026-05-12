/** Message protocol utilities for plugin-local-service communication.
 *
 *  All outbound messages are built through helpers so the wire format is
 *  defined in a single place.
 */

const MSG_TYPE = {
  PLUGIN_CONNECTED: "PLUGIN_CONNECTED",
  PING: "PING",
  PONG: "PONG",
  STATUS_REPORT: "STATUS_REPORT",
};

function build(type, payload = {}) {
  return JSON.stringify({ type, payload, ts: Date.now() });
}

function pluginConnected(info = {}) {
  const version =
    (typeof chrome !== "undefined" && chrome.runtime?.getManifest?.()?.version) ||
    "unknown";
  return build(MSG_TYPE.PLUGIN_CONNECTED, {
    version,
    ...info,
  });
}

function ping() {
  return build(MSG_TYPE.PING, {});
}

function pong() {
  return build(MSG_TYPE.PONG, {});
}

function statusReport(status) {
  return build(MSG_TYPE.STATUS_REPORT, { status });
}

function parse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ESM / CommonJS / service-worker compatibility
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MSG_TYPE,
    build,
    pluginConnected,
    ping,
    pong,
    statusReport,
    parse,
  };
}
