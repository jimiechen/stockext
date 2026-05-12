/** Unit tests for StateManager. */

const { WS_STATE, StateManager } = require("../../utils/state.js");

describe("StateManager initial state", () => {
  test("starts as WS_DISCONNECTED", () => {
    const sm = new StateManager();
    expect(sm.state).toBe(WS_STATE.WS_DISCONNECTED);
    expect(sm.is(WS_STATE.WS_DISCONNECTED)).toBe(true);
  });
});

describe("StateManager.transition", () => {
  test("moves to new state", () => {
    const sm = new StateManager();
    sm.transition(WS_STATE.WS_CONNECTING);
    expect(sm.state).toBe(WS_STATE.WS_CONNECTING);
  });

  test("moves to connected", () => {
    const sm = new StateManager();
    sm.transition(WS_STATE.WS_CONNECTING);
    sm.transition(WS_STATE.WS_CONNECTED);
    expect(sm.state).toBe(WS_STATE.WS_CONNECTED);
  });

  test("no-op when transitioning to same state", () => {
    const sm = new StateManager();
    const calls = [];
    sm.onTransition((oldS, newS) => calls.push({ oldS, newS }));
    sm.transition(WS_STATE.WS_DISCONNECTED);
    expect(calls.length).toBe(0);
  });
});

describe("StateManager.onTransition", () => {
  test("notifies listeners on change", () => {
    const sm = new StateManager();
    const changes = [];
    sm.onTransition((oldS, newS) => changes.push({ oldS, newS }));
    sm.transition(WS_STATE.WS_CONNECTING);
    expect(changes).toEqual([
      { oldS: WS_STATE.WS_DISCONNECTED, newS: WS_STATE.WS_CONNECTING },
    ]);
  });

  test("supports multiple listeners", () => {
    const sm = new StateManager();
    const a = [];
    const b = [];
    sm.onTransition((o, n) => a.push(n));
    sm.onTransition((o, n) => b.push(n));
    sm.transition(WS_STATE.WS_CONNECTED);
    expect(a).toEqual([WS_STATE.WS_CONNECTED]);
    expect(b).toEqual([WS_STATE.WS_CONNECTED]);
  });

  test("unsubscribe stops notifications", () => {
    const sm = new StateManager();
    const changes = [];
    const unsub = sm.onTransition((o, n) => changes.push(n));
    unsub();
    sm.transition(WS_STATE.WS_CONNECTING);
    expect(changes.length).toBe(0);
  });

  test("listener exceptions do not break others", () => {
    const sm = new StateManager();
    const changes = [];
    sm.onTransition(() => {
      throw new Error("boom");
    });
    sm.onTransition((o, n) => changes.push(n));
    sm.transition(WS_STATE.WS_CONNECTING);
    expect(changes).toEqual([WS_STATE.WS_CONNECTING]);
  });
});
