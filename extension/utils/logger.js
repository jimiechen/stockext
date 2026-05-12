/** Minimal logger for extension background script.
 *
 *  Prefixes all messages with [StockExt] and supports info / warn / error levels.
 */

const PREFIX = "[StockExt]";

function info(...args) {
  console.log(PREFIX, ...args);
}

function warn(...args) {
  console.warn(PREFIX, ...args);
}

function error(...args) {
  console.error(PREFIX, ...args);
}

// Service Worker global binding
if (typeof self !== "undefined") {
  self.logger = { info, warn, error };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { info, warn, error };
}
