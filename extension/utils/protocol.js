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
  ANALYZE_REQUEST: "ANALYZE_REQUEST",
  ANALYZE_PROGRESS: "ANALYZE_PROGRESS",
  ANALYZE_RESPONSE: "ANALYZE_RESPONSE",
  ERROR: "ERROR",
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

function analyzeRequest(requestId, taskId, payload) {
  return build(MSG_TYPE.ANALYZE_REQUEST, {
    request_id: requestId,
    task_id: taskId,
    ...payload,
  });
}

function analyzeProgress(requestId, taskId, stage, detail = {}) {
  return build(MSG_TYPE.ANALYZE_PROGRESS, {
    request_id: requestId,
    task_id: taskId,
    stage,
    ...detail,
  });
}

function analyzeResponse(requestId, taskId, payload) {
  return build(MSG_TYPE.ANALYZE_RESPONSE, {
    request_id: requestId,
    task_id: taskId,
    ...payload,
  });
}

function error(requestId, taskId, code, message, retryable = false) {
  return build(MSG_TYPE.ERROR, {
    request_id: requestId,
    task_id: taskId,
    code,
    message,
    retryable,
  });
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
    analyzeRequest,
    analyzeProgress,
    analyzeResponse,
    error,
    parse,
  };
}
