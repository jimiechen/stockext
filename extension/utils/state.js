/** Simple state machine for WebSocket connection lifecycle.
 *
 *  States: WS_DISCONNECTED -> WS_CONNECTING -> WS_CONNECTED
 *          WS_CONNECTED    -> WS_DISCONNECTED
 *          WS_CONNECTING   -> WS_DISCONNECTED (on error / max retries)
 */

const WS_STATE = {
  WS_DISCONNECTED: "WS_DISCONNECTED",
  WS_CONNECTING: "WS_CONNECTING",
  WS_CONNECTED: "WS_CONNECTED",
};

class StateManager {
  constructor() {
    this._state = WS_STATE.WS_DISCONNECTED;
    this._listeners = [];
  }

  get state() {
    return this._state;
  }

  is(state) {
    return this._state === state;
  }

  transition(newState) {
    const oldState = this._state;
    if (oldState === newState) return;
    this._state = newState;
    this._emit(oldState, newState);
  }

  onTransition(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== fn);
    };
  }

  _emit(oldState, newState) {
    for (const fn of this._listeners) {
      try {
        fn(oldState, newState);
      } catch {
        // ignore listener errors
      }
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { WS_STATE, StateManager };
}
