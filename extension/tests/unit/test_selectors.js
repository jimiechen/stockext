/** Unit tests for selectors.js
 *
 *  Coverage: selector configuration, querySelector fallback logic.
 */

const { SELECTORS, querySelector, querySelectorAll } = require("../../selectors");

describe("SELECTORS config", () => {
  test("exports all required selectors", () => {
    expect(SELECTORS).toHaveProperty("inputBox");
    expect(SELECTORS).toHaveProperty("sendButton");
    expect(SELECTORS).toHaveProperty("messageList");
    expect(SELECTORS).toHaveProperty("stopButton");
    expect(SELECTORS).toHaveProperty("newChatButton");
    expect(SELECTORS).toHaveProperty("loginButton");
    expect(SELECTORS).toHaveProperty("loginQRCode");
    expect(SELECTORS).toHaveProperty("loginPhoneInput");
    expect(SELECTORS).toHaveProperty("chatArea");
    expect(SELECTORS).toHaveProperty("userMessage");
    expect(SELECTORS).toHaveProperty("assistantMessage");
  });

  test("core selectors are arrays (fallbacks)", () => {
    expect(Array.isArray(SELECTORS.inputBox)).toBe(true);
    expect(Array.isArray(SELECTORS.sendButton)).toBe(true);
    expect(Array.isArray(SELECTORS.assistantMessage)).toBe(true);
  });

  test("selectors are non-empty strings", () => {
    for (const [key, val] of Object.entries(SELECTORS)) {
      const arr = Array.isArray(val) ? val : [val];
      for (const sel of arr) {
        expect(typeof sel).toBe("string");
        expect(sel.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("querySelector", () => {
  test("returns element when first selector matches", () => {
    document.body.innerHTML = '<div id="target"></div>';
    const el = querySelector(document, ['#target', '.missing']);
    expect(el).not.toBeNull();
    expect(el.id).toBe("target");
  });

  test("falls back to second selector when first misses", () => {
    document.body.innerHTML = '<div class="fallback"></div>';
    const el = querySelector(document, ['#missing', '.fallback']);
    expect(el).not.toBeNull();
    expect(el.className).toBe("fallback");
  });

  test("returns null when all selectors miss", () => {
    document.body.innerHTML = '<div></div>';
    const el = querySelector(document, ['#missing', '.missing']);
    expect(el).toBeNull();
  });

  test("handles single string selector", () => {
    document.body.innerHTML = '<span class="single"></span>';
    const el = querySelector(document, '.single');
    expect(el).not.toBeNull();
  });

  test("skips invalid selectors gracefully", () => {
    document.body.innerHTML = '<div class="valid"></div>';
    const el = querySelector(document, [':invalid(', '.valid']);
    expect(el).not.toBeNull();
    expect(el.className).toBe("valid");
  });
});

describe("querySelectorAll", () => {
  test("returns all matching elements", () => {
    document.body.innerHTML = '<p class="item"></p><p class="item"></p>';
    const els = querySelectorAll(document, '.item');
    expect(els.length).toBe(2);
  });

  test("returns empty array when nothing matches", () => {
    document.body.innerHTML = '<div></div>';
    const els = querySelectorAll(document, '.nothing');
    expect(els).toEqual([]);
  });

  test("falls back through selector array", () => {
    document.body.innerHTML = '<span class="b"></span>';
    const els = querySelectorAll(document, ['.a', '.b']);
    expect(els.length).toBe(1);
  });
});
