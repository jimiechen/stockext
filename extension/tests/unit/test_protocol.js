/** Unit tests for protocol message builders. */

const protocol = require("../../utils/protocol.js");

describe("protocol.build", () => {
  test("returns JSON string with type, payload and ts", () => {
    const raw = protocol.build("TEST", { a: 1 });
    const msg = JSON.parse(raw);
    expect(msg.type).toBe("TEST");
    expect(msg.payload).toEqual({ a: 1 });
    expect(typeof msg.ts).toBe("number");
  });
});

describe("protocol.pluginConnected", () => {
  test("includes PLUGIN_CONNECTED type and version info", () => {
    const raw = protocol.pluginConnected();
    const msg = JSON.parse(raw);
    expect(msg.type).toBe("PLUGIN_CONNECTED");
    expect(typeof msg.payload.version).toBe("string");
    expect(typeof msg.ts).toBe("number");
  });

  test("merges extra info into payload", () => {
    const raw = protocol.pluginConnected({ user: "alice" });
    const msg = JSON.parse(raw);
    expect(msg.payload.user).toBe("alice");
  });
});

describe("protocol.ping", () => {
  test("returns PING message", () => {
    const raw = protocol.ping();
    const msg = JSON.parse(raw);
    expect(msg.type).toBe("PING");
    expect(msg.payload).toEqual({});
  });
});

describe("protocol.pong", () => {
  test("returns PONG message", () => {
    const raw = protocol.pong();
    const msg = JSON.parse(raw);
    expect(msg.type).toBe("PONG");
    expect(msg.payload).toEqual({});
  });
});

describe("protocol.statusReport", () => {
  test("returns STATUS_REPORT with given status", () => {
    const raw = protocol.statusReport("ok");
    const msg = JSON.parse(raw);
    expect(msg.type).toBe("STATUS_REPORT");
    expect(msg.payload.status).toBe("ok");
  });
});

describe("protocol.parse", () => {
  test("parses valid JSON", () => {
    const obj = protocol.parse('{"type":"X"}');
    expect(obj.type).toBe("X");
  });

  test("returns null for invalid JSON", () => {
    expect(protocol.parse("not json")).toBeNull();
  });
});
