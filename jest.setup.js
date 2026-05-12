/** Jest setup – global mocks for Chrome Extension APIs */

// Polyfill TextEncoder/TextDecoder for jsdom
global.TextEncoder = require("util").TextEncoder;
global.TextDecoder = require("util").TextDecoder;

// Mock chrome.runtime
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    sendMessage: jest.fn(),
    getURL: jest.fn((path) => `chrome-extension://test-id/${path}`),
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
};
