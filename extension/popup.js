/** Popup script – displays plugin status fetched from the background script.
 *
 *  Responsibilities:
 *  - On DOMContentLoaded, request current status from background.
 *  - Render: local service status, DeepSeek page status, task status,
 *    last error, last task duration.
 *  - Never write sensitive fields (token, webhookUrl, etc.) to DOM.
 */

(function () {
  const LABELS = {
    local: {
      connected:    { text: "已连接", className: "status-ok" },
      connecting:   { text: "连接中", className: "status-warn" },
      disconnected: { text: "未连接", className: "status-err" },
    },
    deepseek: {
      not_found: { text: "未找到", className: "status-warn" },
      found:     { text: "已找到", className: "status-ok" },
      ready:     { text: "就绪",   className: "status-ok" },
    },
    task: {
      idle:    { text: "空闲",   className: "status-idle" },
      running: { text: "执行中", className: "status-warn" },
      success: { text: "成功",   className: "status-ok" },
      failed:  { text: "失败",   className: "status-err" },
    },
  };

  function getElement(id) {
    return document.getElementById(id);
  }

  function setStatus(elId, mapping, key) {
    const el = getElement(elId);
    if (!el) return;
    const entry = mapping[key] || { text: String(key), className: "" };
    el.textContent = entry.text;
    el.className = "value " + entry.className;
  }

  function render(data) {
    if (!data || typeof data !== "object") return;

    setStatus("local-status",    LABELS.local,    data.localStatus);
    setStatus("deepseek-status", LABELS.deepseek, data.deepseekStatus);
    setStatus("task-status",     LABELS.task,     data.taskStatus);

    const errEl = getElement("last-error");
    if (errEl) {
      if (data.lastError && (data.lastError.code || data.lastError.message)) {
        const code = data.lastError.code || "";
        const msg = data.lastError.message || "";
        errEl.textContent = (code ? code + ": " : "") + msg;
        errEl.className = "value status-err";
      } else {
        errEl.textContent = "无";
        errEl.className = "value";
      }
    }

    const durEl = getElement("last-duration");
    if (durEl) {
      const ms = typeof data.lastDurationMs === "number" ? data.lastDurationMs : 0;
      durEl.textContent = ms + " ms";
    }

    const updatedEl = getElement("last-updated");
    if (updatedEl) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      updatedEl.textContent =
        pad(now.getHours()) + ":" +
        pad(now.getMinutes()) + ":" +
        pad(now.getSeconds());
    }
  }

  function requestStatus() {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }
    chrome.runtime.sendMessage({ action: "getStatus" }, (response) => {
      if (chrome.runtime.lastError) {
        // Silently ignore; keep current/default display
        return;
      }
      render(response);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", requestStatus);
  } else {
    requestStatus();
  }
})();
