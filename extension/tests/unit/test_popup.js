/** Unit tests for popup logic (popup.js).
 *
 *  Tests the pure functions that render state into DOM updates.
 *  Chrome APIs are mocked via jest.
 */

// Minimal DOM setup before loading popup.js
const { JSDOM } = require("jsdom");

function createPopupDocument() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <body>
      <div id="local-status">未连接</div>
      <div id="deepseek-status">未找到</div>
      <div id="task-status">空闲</div>
      <div id="last-error">无</div>
      <div id="last-duration">-</div>
      <div id="last-updated">-</div>
    </body>
    </html>
  `, { url: "https://localhost" });
  return dom.window.document;
}

// Mock chrome.runtime before requiring popup.js
const mockSendMessage = jest.fn();
const mockGetManifest = jest.fn(() => ({ version: "0.2.0" }));

global.chrome = {
  runtime: {
    sendMessage: mockSendMessage,
    getManifest: mockGetManifest,
  },
};

// We will load popup.js inside each test with a fresh document.
// popup.js uses DOMContentLoaded; we simulate that manually.

function loadPopupLogic(document) {
  global.document = document;
  // Clear module cache so each test gets a fresh load
  jest.resetModules();
  require("../../popup.js");
}

function dispatchDOMContentLoaded(document) {
  const event = document.createEvent("Event");
  event.initEvent("DOMContentLoaded", true, true);
  document.dispatchEvent(event);
}

describe("Popup initial render", () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
  });

  test("requests status from background on load", () => {
    const doc = createPopupDocument();
    loadPopupLogic(doc);
    dispatchDOMContentLoaded(doc);

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith(
      { action: "getStatus" },
      expect.any(Function)
    );
  });

  test("renders default values before response", () => {
    const doc = createPopupDocument();
    loadPopupLogic(doc);
    // Do NOT dispatch DOMContentLoaded so no callback fires
    // (default text already in HTML)
    expect(doc.getElementById("local-status").textContent).toBe("未连接");
    expect(doc.getElementById("deepseek-status").textContent).toBe("未找到");
    expect(doc.getElementById("task-status").textContent).toBe("空闲");
    expect(doc.getElementById("last-error").textContent).toBe("无");
    expect(doc.getElementById("last-duration").textContent).toBe("-");
  });
});

describe("Popup status update", () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
  });

  test("renders connected local service", () => {
    const doc = createPopupDocument();
    loadPopupLogic(doc);
    dispatchDOMContentLoaded(doc);

    const callback = mockSendMessage.mock.calls[0][1];
    callback({
      localStatus: "connected",
      deepseekStatus: "ready",
      taskStatus: "idle",
      lastError: null,
      lastDurationMs: 0,
    });

    expect(doc.getElementById("local-status").textContent).toBe("已连接");
    expect(doc.getElementById("local-status").className).toBe("value status-ok");
    expect(doc.getElementById("deepseek-status").textContent).toBe("就绪");
    expect(doc.getElementById("deepseek-status").className).toBe("value status-ok");
    expect(doc.getElementById("task-status").textContent).toBe("空闲");
    expect(doc.getElementById("task-status").className).toBe("value status-idle");
    expect(doc.getElementById("last-error").textContent).toBe("无");
    expect(doc.getElementById("last-duration").textContent).toBe("0 ms");
  });

  test("renders connecting local service", () => {
    const doc = createPopupDocument();
    loadPopupLogic(doc);
    dispatchDOMContentLoaded(doc);

    const callback = mockSendMessage.mock.calls[0][1];
    callback({
      localStatus: "connecting",
      deepseekStatus: "not_found",
      taskStatus: "running",
      lastError: null,
      lastDurationMs: 1234,
    });

    expect(doc.getElementById("local-status").textContent).toBe("连接中");
    expect(doc.getElementById("local-status").className).toBe("value status-warn");
    expect(doc.getElementById("deepseek-status").textContent).toBe("未找到");
    expect(doc.getElementById("deepseek-status").className).toBe("value status-warn");
    expect(doc.getElementById("task-status").textContent).toBe("执行中");
    expect(doc.getElementById("task-status").className).toBe("value status-warn");
    expect(doc.getElementById("last-duration").textContent).toBe("1234 ms");
  });

  test("renders disconnected local service with error", () => {
    const doc = createPopupDocument();
    loadPopupLogic(doc);
    dispatchDOMContentLoaded(doc);

    const callback = mockSendMessage.mock.calls[0][1];
    callback({
      localStatus: "disconnected",
      deepseekStatus: "found",
      taskStatus: "failed",
      lastError: { code: "ECONNREFUSED", message: "Connection refused" },
      lastDurationMs: 5678,
    });

    expect(doc.getElementById("local-status").textContent).toBe("未连接");
    expect(doc.getElementById("local-status").className).toBe("value status-err");
    expect(doc.getElementById("deepseek-status").textContent).toBe("已找到");
    expect(doc.getElementById("deepseek-status").className).toBe("value status-ok");
    expect(doc.getElementById("task-status").textContent).toBe("失败");
    expect(doc.getElementById("task-status").className).toBe("value status-err");
    expect(doc.getElementById("last-error").textContent).toBe(
      "ECONNREFUSED: Connection refused"
    );
    expect(doc.getElementById("last-duration").textContent).toBe("5678 ms");
  });

  test("handles missing response gracefully", () => {
    const doc = createPopupDocument();
    loadPopupLogic(doc);
    dispatchDOMContentLoaded(doc);

    const callback = mockSendMessage.mock.calls[0][1];
    // Simulate chrome.runtime.lastError or no response
    callback(undefined);

    // Should keep default text and not throw
    expect(doc.getElementById("local-status").textContent).toBe("未连接");
  });

  test("does not leak sensitive fields", () => {
    const doc = createPopupDocument();
    loadPopupLogic(doc);
    dispatchDOMContentLoaded(doc);

    const callback = mockSendMessage.mock.calls[0][1];
    callback({
      localStatus: "connected",
      deepseekStatus: "ready",
      taskStatus: "success",
      lastError: null,
      lastDurationMs: 100,
      token: "secret-token-123",
      webhookUrl: "https://secret.example.com/hook",
    });

    // Ensure popup.js never writes these to DOM
    const html = doc.body.innerHTML;
    expect(html).not.toContain("secret-token-123");
    expect(html).not.toContain("https://secret.example.com/hook");
  });
});

describe("Popup status label helpers (via DOM result)", () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
  });

  test.each([
    ["connected", "已连接", "status-ok"],
    ["connecting", "连接中", "status-warn"],
    ["disconnected", "未连接", "status-err"],
  ])("localStatus %s -> %s (%s)", (raw, label, cls) => {
    const doc = createPopupDocument();
    loadPopupLogic(doc);
    dispatchDOMContentLoaded(doc);

    const callback = mockSendMessage.mock.calls[0][1];
    callback({
      localStatus: raw,
      deepseekStatus: "not_found",
      taskStatus: "idle",
      lastError: null,
      lastDurationMs: 0,
    });

    expect(doc.getElementById("local-status").textContent).toBe(label);
    expect(doc.getElementById("local-status").className).toBe("value " + cls);
  });

  test.each([
    ["not_found", "未找到", "status-warn"],
    ["found", "已找到", "status-ok"],
    ["ready", "就绪", "status-ok"],
  ])("deepseekStatus %s -> %s (%s)", (raw, label, cls) => {
    const doc = createPopupDocument();
    loadPopupLogic(doc);
    dispatchDOMContentLoaded(doc);

    const callback = mockSendMessage.mock.calls[0][1];
    callback({
      localStatus: "connected",
      deepseekStatus: raw,
      taskStatus: "idle",
      lastError: null,
      lastDurationMs: 0,
    });

    expect(doc.getElementById("deepseek-status").textContent).toBe(label);
    expect(doc.getElementById("deepseek-status").className).toBe("value " + cls);
  });

  test.each([
    ["idle", "空闲", "status-idle"],
    ["running", "执行中", "status-warn"],
    ["success", "成功", "status-ok"],
    ["failed", "失败", "status-err"],
  ])("taskStatus %s -> %s (%s)", (raw, label, cls) => {
    const doc = createPopupDocument();
    loadPopupLogic(doc);
    dispatchDOMContentLoaded(doc);

    const callback = mockSendMessage.mock.calls[0][1];
    callback({
      localStatus: "connected",
      deepseekStatus: "ready",
      taskStatus: raw,
      lastError: null,
      lastDurationMs: 0,
    });

    expect(doc.getElementById("task-status").textContent).toBe(label);
    expect(doc.getElementById("task-status").className).toBe("value " + cls);
  });
});
