/** DOM selector configuration for DeepSeek web page.
 *
 *  All selectors are centralized here so that when DeepSeek updates
 *  its layout only this file needs to be changed.
 *
 *  Each key can be either a single string or an array of strings
 *  (fallbacks tried left-to-right).
 */

const SELECTORS = {
  // Core input elements
  inputBox: [
    'textarea[data-testid="chat-input"]',
    'textarea[placeholder*="发消息"]',
    'textarea',
  ],
  sendButton: [
    'button[data-testid="send-button"]',
    'button[type="submit"]',
    'button svg[viewBox]',
    'button',
  ],

  // Message list
  messageList: [
    '[data-testid="message-list"]',
    '[class*="message-list"]',
    '[class*="chat-messages"]',
  ],

  // Stop generation button (visible while AI is generating)
  stopButton: [
    'button[data-testid="stop-button"]',
    'button[class*="stop"]',
    'button svg[class*="stop"]',
  ],

  // New chat button
  newChatButton: [
    'button[data-testid="new-chat"]',
    'button[class*="new-chat"]',
  ],

  // Login detection
  loginButton: [
    'button:has-text("登录")',
    'button[class*="login"]',
    'a[href*="login"]',
  ],
  loginQRCode: [
    '[class*="qrcode"]',
    'img[alt*="二维码"]',
  ],
  loginPhoneInput: [
    'input[type="tel"]',
    'input[placeholder*="手机号"]',
  ],

  // Chat area
  chatArea: [
    '[data-testid="chat-area"]',
    '[class*="chat-area"]',
    '[class*="conversation"]',
  ],
  userMessage: [
    '[data-testid="user-message"]',
    '[class*="user-message"]',
    '[class*="message-user"]',
  ],
  assistantMessage: [
    '[data-testid="assistant-message"]',
    '[class*="assistant-message"]',
    '[class*="message-assistant"]',
    '[class*="ai-message"]',
  ],
};

/**
 * Try to find an element using the configured selector(s).
 *
 * @param {Document} doc - The document to search within.
 * @param {string|string[]} selector - Single selector or array of fallback selectors.
 * @returns {Element|null} - The first matching element, or null.
 */
function querySelector(doc, selector) {
  const candidates = Array.isArray(selector) ? selector : [selector];
  for (const sel of candidates) {
    try {
      const el = doc.querySelector(sel);
      if (el) return el;
    } catch {
      // Invalid selector syntax, try next
    }
  }
  return null;
}

/**
 * Try to find all elements matching the configured selector(s).
 *
 * @param {Document} doc - The document to search within.
 * @param {string|string[]} selector - Single selector or array of fallback selectors.
 * @returns {Element[]} - All matching elements.
 */
function querySelectorAll(doc, selector) {
  const candidates = Array.isArray(selector) ? selector : [selector];
  for (const sel of candidates) {
    try {
      const els = doc.querySelectorAll(sel);
      if (els.length > 0) return Array.from(els);
    } catch {
      // Invalid selector syntax, try next
    }
  }
  return [];
}

// ESM / CommonJS / service-worker compatibility
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SELECTORS, querySelector, querySelectorAll };
}
