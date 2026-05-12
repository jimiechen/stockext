/** Unit tests for content.js
 *
 *  Coverage: page status detection, prompt input, send, result extraction.
 */

const {
  DS_STATUS,
  ERROR_CODE,
  checkPageStatus,
  inputPrompt,
  clickSend,
  extractResult,
  querySelector,
} = require("../../content");

describe("DS_STATUS constants", () => {
  test("exports all status codes", () => {
    expect(DS_STATUS.DS_PAGE_NOT_FOUND).toBe("DS_PAGE_NOT_FOUND");
    expect(DS_STATUS.CONTENT_SCRIPT_NOT_READY).toBe("CONTENT_SCRIPT_NOT_READY");
    expect(DS_STATUS.DS_NOT_LOGIN).toBe("DS_NOT_LOGIN");
    expect(DS_STATUS.DS_PAGE_NOT_READY).toBe("DS_PAGE_NOT_READY");
    expect(DS_STATUS.DS_READY).toBe("DS_READY");
  });
});

describe("checkPageStatus", () => {
  test("returns DS_READY when input and send button exist", () => {
    document.body.innerHTML = `
      <textarea></textarea>
      <button type="submit"></button>
    `;
    const result = checkPageStatus();
    expect(result.status).toBe(DS_STATUS.DS_READY);
  });

  test("returns DS_NOT_LOGIN when login button exists", () => {
    document.body.innerHTML = `
      <button class="login">登录</button>
    `;
    const result = checkPageStatus();
    expect(result.status).toBe(DS_STATUS.DS_NOT_LOGIN);
  });

  test("returns DS_NOT_LOGIN when QR code exists", () => {
    document.body.innerHTML = `
      <div class="qrcode"></div>
    `;
    const result = checkPageStatus();
    expect(result.status).toBe(DS_STATUS.DS_NOT_LOGIN);
  });

  test("returns DS_PAGE_NOT_READY when no relevant elements", () => {
    document.body.innerHTML = `<div>some other content</div>`;
    const result = checkPageStatus();
    expect(result.status).toBe(DS_STATUS.DS_PAGE_NOT_READY);
  });
});

describe("inputPrompt", () => {
  test("returns success when input exists", () => {
    document.body.innerHTML = `<textarea id="input"></textarea>`;
    const result = inputPrompt("test prompt");
    expect(result.success).toBe(true);
    const inputEl = document.querySelector("textarea");
    expect(inputEl.value).toBe("test prompt");
  });

  test("returns DS_INPUT_NOT_FOUND when input missing", () => {
    document.body.innerHTML = `<div></div>`;
    const result = inputPrompt("test");
    expect(result.success).toBe(false);
    expect(result.error).toBe(ERROR_CODE.DS_INPUT_NOT_FOUND);
  });
});

describe("clickSend", () => {
  test("returns success when send button exists", () => {
    document.body.innerHTML = `<button type="submit">Send</button>`;
    const result = clickSend();
    expect(result.success).toBe(true);
  });

  test("returns DS_SEND_BUTTON_NOT_FOUND when button missing", () => {
    document.body.innerHTML = `<div></div>`;
    const result = clickSend();
    expect(result.success).toBe(false);
    expect(result.error).toBe(ERROR_CODE.DS_SEND_BUTTON_NOT_FOUND);
  });
});

describe("extractResult", () => {
  test("returns result when assistant message exists", () => {
    document.body.innerHTML = `
      <div class="assistant-message">This is a response with enough length.</div>
    `;
    const result = extractResult();
    expect(result.success).toBe(true);
    expect(result.result).toBe("This is a response with enough length.");
  });

  test("returns DS_RESPONSE_EMPTY when message too short", () => {
    document.body.innerHTML = `
      <div class="assistant-message">short</div>
    `;
    const result = extractResult();
    expect(result.success).toBe(false);
    expect(result.error).toBe(ERROR_CODE.DS_RESPONSE_EMPTY);
  });

  test("returns RESULT_EXTRACT_FAILED when no messages", () => {
    document.body.innerHTML = `<div></div>`;
    const result = extractResult();
    expect(result.success).toBe(false);
    expect(result.error).toBe(ERROR_CODE.RESULT_EXTRACT_FAILED);
  });
});

describe("querySelector", () => {
  test("finds element with fallback selectors", () => {
    document.body.innerHTML = `<div class="target"></div>`;
    const el = querySelector(document, ["#missing", ".target"]);
    expect(el).not.toBeNull();
    expect(el.className).toBe("target");
  });

  test("returns null when all selectors miss", () => {
    document.body.innerHTML = `<div></div>`;
    const el = querySelector(document, ["#missing", ".missing"]);
    expect(el).toBeNull();
  });
});
