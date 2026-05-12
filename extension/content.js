/** Content Script – injected into https://chat.deepseek.com/*
 *
 *  Responsibilities:
 *  - Detect page readiness and login state
 *  - Receive ANALYZE_REQUEST from background script
 *  - Input prompt, send, wait for response, extract result
 *  - Report progress and errors back to background script
 */

// Import selectors (in content script we can use regular script tags or import)
// For MV3 content scripts, we use inline definitions or chrome.runtime.getURL
const SELECTORS = {
  inputBox: [
    'textarea[data-testid="chat-input"]',
    'textarea[placeholder*="发消息"]',
    'textarea',
  ],
  sendButton: [
    'button[data-testid="send-button"]',
    'button[type="submit"]',
    'button',
  ],
  stopButton: [
    'button[data-testid="stop-button"]',
    'button[class*="stop"]',
  ],
  assistantMessage: [
    '[data-testid="assistant-message"]',
    '[class*="assistant-message"]',
    '[class*="message-assistant"]',
    '[class*="ai-message"]',
  ],
  loginButton: [
    'button:has-text("登录")',
    'button[class*="login"]',
  ],
  loginQRCode: [
    '[class*="qrcode"]',
  ],
  loginPhoneInput: [
    'input[type="tel"]',
  ],
};

/** DeepSeek page status codes */
const DS_STATUS = {
  DS_PAGE_NOT_FOUND: "DS_PAGE_NOT_FOUND",
  CONTENT_SCRIPT_NOT_READY: "CONTENT_SCRIPT_NOT_READY",
  DS_NOT_LOGIN: "DS_NOT_LOGIN",
  DS_PAGE_NOT_READY: "DS_PAGE_NOT_READY",
  DS_READY: "DS_READY",
};

/** Task stage codes */
const STAGE = {
  DS_PAGE_CHECKING: "DS_PAGE_CHECKING",
  DS_PAGE_READY: "DS_PAGE_READY",
  INPUTTING_PROMPT: "INPUTTING_PROMPT",
  PROMPT_SENT: "PROMPT_SENT",
  WAITING_RESPONSE: "WAITING_RESPONSE",
  RESPONSE_DONE: "RESPONSE_DONE",
  RESULT_EXTRACTED: "RESULT_EXTRACTED",
};

/** Error codes */
const ERROR_CODE = {
  DS_INPUT_NOT_FOUND: "DS_INPUT_NOT_FOUND",
  DS_SEND_BUTTON_NOT_FOUND: "DS_SEND_BUTTON_NOT_FOUND",
  DS_SEND_FAILED: "DS_SEND_FAILED",
  DS_RESPONSE_TIMEOUT: "DS_RESPONSE_TIMEOUT",
  DS_RESPONSE_EMPTY: "DS_RESPONSE_EMPTY",
  RESULT_EXTRACT_FAILED: "RESULT_EXTRACT_FAILED",
};

/**
 * Query element with fallback selectors.
 */
function querySelector(doc, selectors) {
  const arr = Array.isArray(selectors) ? selectors : [selectors];
  for (const sel of arr) {
    try {
      const el = doc.querySelector(sel);
      if (el) return el;
    } catch {
      // ignore invalid selector
    }
  }
  return null;
}

/**
 * Query all elements with fallback selectors.
 */
function querySelectorAll(doc, selectors) {
  const arr = Array.isArray(selectors) ? selectors : [selectors];
  for (const sel of arr) {
    try {
      const els = doc.querySelectorAll(sel);
      if (els.length > 0) return Array.from(els);
    } catch {
      // ignore invalid selector
    }
  }
  return [];
}

/**
 * Check DeepSeek page status.
 *
 * @returns {{status: string, reason?: string}}
 */
function checkPageStatus() {
  const inputEl = querySelector(document, SELECTORS.inputBox);
  const sendBtn = querySelector(document, SELECTORS.sendButton);

  if (inputEl && sendBtn) {
    return { status: DS_STATUS.DS_READY };
  }

  // Check login indicators
  const loginBtn = querySelector(document, SELECTORS.loginButton);
  const qrCode = querySelector(document, SELECTORS.loginQRCode);
  const phoneInput = querySelector(document, SELECTORS.loginPhoneInput);

  if (loginBtn || qrCode || phoneInput) {
    return { status: DS_STATUS.DS_NOT_LOGIN, reason: "Login elements detected" };
  }

  return { status: DS_STATUS.DS_PAGE_NOT_READY, reason: "Input or send button not found" };
}

/**
 * Input prompt into the chat input box.
 *
 * @param {string} prompt
 * @returns {{success: boolean, error?: string}}
 */
function inputPrompt(prompt) {
  const inputEl = querySelector(document, SELECTORS.inputBox);
  if (!inputEl) {
    return { success: false, error: ERROR_CODE.DS_INPUT_NOT_FOUND };
  }

  // Focus and clear
  inputEl.focus();
  inputEl.value = "";
  inputEl.dispatchEvent(new Event("input", { bubbles: true }));

  // Type prompt
  inputEl.value = prompt;
  inputEl.dispatchEvent(new Event("input", { bubbles: true }));

  return { success: true };
}

/**
 * Click the send button.
 *
 * @returns {{success: boolean, error?: string}}
 */
function clickSend() {
  const sendBtn = querySelector(document, SELECTORS.sendButton);
  if (!sendBtn) {
    return { success: false, error: ERROR_CODE.DS_SEND_BUTTON_NOT_FOUND };
  }

  sendBtn.click();
  return { success: true };
}

/**
 * Wait for AI response to complete.
 *
 * Uses a combination of:
 * - Stop button disappearance
 * - Text stability (5 seconds no change)
 * - Minimum response length (20 chars)
 * - Max timeout (180 seconds)
 *
 * @param {object} options
 * @param {number} options.maxWaitMs
 * @param {number} options.stableMs
 * @param {number} options.minLength
 * @returns {Promise<{success: boolean, result?: string, error?: string, durationMs: number}>}
 */
async function waitForResponse(options = {}) {
  const maxWaitMs = options.maxWaitMs || 180000;
  const stableMs = options.stableMs || 5000;
  const minLength = options.minLength || 20;
  const pollInterval = 1000;

  const startTime = Date.now();
  let lastText = "";
  let stableStart = 0;

  while (Date.now() - startTime < maxWaitMs) {
    // Check if stop button is still visible (generating)
    const stopBtn = querySelector(document, SELECTORS.stopButton);

    // Get last assistant message
    const messages = document.querySelectorAll(SELECTORS.assistantMessage[0]);
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    const currentText = lastMsg ? lastMsg.textContent || "" : "";

    if (currentText.length >= minLength) {
      if (currentText === lastText) {
        // Text is stable
        if (stableStart === 0) {
          stableStart = Date.now();
        } else if (Date.now() - stableStart >= stableMs) {
          // Stable for required duration
          if (!stopBtn) {
            // Stop button gone = generation complete
            return {
              success: true,
              result: currentText.trim(),
              durationMs: Date.now() - startTime,
            };
          }
        }
      } else {
        // Text changed, reset stability timer
        stableStart = 0;
        lastText = currentText;
      }
    }

    await sleep(pollInterval);
  }

  // Timeout
  return {
    success: false,
    error: ERROR_CODE.DS_RESPONSE_TIMEOUT,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Extract the last assistant message.
 *
 * @returns {{success: boolean, result?: string, error?: string}}
 */
function extractResult() {
  const messages = querySelectorAll(document, SELECTORS.assistantMessage);
  if (messages.length === 0) {
    return { success: false, error: ERROR_CODE.RESULT_EXTRACT_FAILED };
  }

  const lastMsg = messages[messages.length - 1];
  const text = lastMsg.textContent || "";

  if (text.trim().length < 20) {
    return { success: false, error: ERROR_CODE.DS_RESPONSE_EMPTY };
  }

  return { success: true, result: text.trim() };
}

/**
 * Sleep for ms milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a full analysis task.
 *
 * @param {object} task
 * @param {string} task.prompt
 * @param {string} task.taskId
 * @param {number} task.timeoutSeconds
 */
async function executeTask(task) {
  const { prompt, taskId, timeoutSeconds } = task;

  // 1. Check page status
  const pageStatus = checkPageStatus();
  if (pageStatus.status !== DS_STATUS.DS_READY) {
    return {
      type: "ERROR",
      taskId,
      payload: {
        code: pageStatus.status,
        message: pageStatus.reason || pageStatus.status,
        retryable: true,
      },
    };
  }

  // 2. Input prompt
  const inputResult = inputPrompt(prompt);
  if (!inputResult.success) {
    return {
      type: "ERROR",
      taskId,
      payload: {
        code: inputResult.error,
        message: "Failed to input prompt",
        retryable: false,
      },
    };
  }

  // 3. Send
  const sendResult = clickSend();
  if (!sendResult.success) {
    return {
      type: "ERROR",
      taskId,
      payload: {
        code: sendResult.error,
        message: "Failed to send prompt",
        retryable: true,
      },
    };
  }

  // 4. Wait for response
  const waitResult = await waitForResponse({
    maxWaitMs: (timeoutSeconds || 180) * 1000,
  });

  if (!waitResult.success) {
    return {
      type: "ERROR",
      taskId,
      payload: {
        code: waitResult.error,
        message: `Response failed after ${waitResult.durationMs}ms`,
        retryable: waitResult.error === ERROR_CODE.DS_RESPONSE_TIMEOUT,
      },
    };
  }

  // 5. Return result
  return {
    type: "ANALYZE_RESPONSE",
    taskId,
    payload: {
      status: "success",
      result: waitResult.result,
      duration_seconds: Math.round(waitResult.durationMs / 1000),
    },
  };
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "PING_CONTENT") {
    sendResponse({ type: "PONG_CONTENT", payload: { ok: true } });
    return true;
  }

  if (request.type === "CHECK_PAGE_STATUS") {
    const status = checkPageStatus();
    sendResponse({ type: "PAGE_STATUS", payload: status });
    return true;
  }

  if (request.type === "ANALYZE_REQUEST") {
    // Execute asynchronously
    executeTask(request.payload).then((result) => {
      sendResponse(result);
    }).catch((err) => {
      sendResponse({
        type: "ERROR",
        taskId: request.payload?.taskId,
        payload: {
          code: "UNKNOWN_ERROR",
          message: err.message,
          retryable: false,
        },
      });
    });
    return true; // Keep channel open for async response
  }

  return false;
});

// ESM / CommonJS compatibility for tests
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DS_STATUS,
    STAGE,
    ERROR_CODE,
    checkPageStatus,
    inputPrompt,
    clickSend,
    waitForResponse,
    extractResult,
    executeTask,
    querySelector,
  querySelectorAll,
  };
}
