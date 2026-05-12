/** Unit tests for extended protocol.js (T009).
 *
 *  Coverage: analyzeRequest, analyzeProgress, analyzeResponse, error builders.
 */

const {
  MSG_TYPE,
  analyzeRequest,
  analyzeProgress,
  analyzeResponse,
  error,
  parse,
} = require("../../utils/protocol");

describe("MSG_TYPE constants", () => {
  test("includes all message types", () => {
    expect(MSG_TYPE.ANALYZE_REQUEST).toBe("ANALYZE_REQUEST");
    expect(MSG_TYPE.ANALYZE_PROGRESS).toBe("ANALYZE_PROGRESS");
    expect(MSG_TYPE.ANALYZE_RESPONSE).toBe("ANALYZE_RESPONSE");
    expect(MSG_TYPE.ERROR).toBe("ERROR");
  });
});

describe("analyzeRequest", () => {
  test("builds correct message structure", () => {
    const msg = analyzeRequest("req-1", "task-1", {
      stock_code: "000001",
      prompt: "test prompt",
      timeout_seconds: 180,
    });
    const parsed = parse(msg);
    expect(parsed.type).toBe("ANALYZE_REQUEST");
    expect(parsed.payload.request_id).toBe("req-1");
    expect(parsed.payload.task_id).toBe("task-1");
    expect(parsed.payload.stock_code).toBe("000001");
    expect(parsed.payload.prompt).toBe("test prompt");
    expect(parsed.payload.timeout_seconds).toBe(180);
    expect(parsed.ts).toBeDefined();
  });
});

describe("analyzeProgress", () => {
  test("builds progress message", () => {
    const msg = analyzeProgress("req-1", "task-1", "PROMPT_SENT", {
      detail: "Prompt sent successfully",
    });
    const parsed = parse(msg);
    expect(parsed.type).toBe("ANALYZE_PROGRESS");
    expect(parsed.payload.stage).toBe("PROMPT_SENT");
    expect(parsed.payload.detail).toBe("Prompt sent successfully");
  });
});

describe("analyzeResponse", () => {
  test("builds response message", () => {
    const msg = analyzeResponse("req-1", "task-1", {
      status: "success",
      result: "analysis result",
      duration_seconds: 30,
    });
    const parsed = parse(msg);
    expect(parsed.type).toBe("ANALYZE_RESPONSE");
    expect(parsed.payload.status).toBe("success");
    expect(parsed.payload.result).toBe("analysis result");
    expect(parsed.payload.duration_seconds).toBe(30);
  });
});

describe("error", () => {
  test("builds error message with retryable=true", () => {
    const msg = error("req-1", "task-1", "DS_PAGE_NOT_FOUND", "Page not found", true);
    const parsed = parse(msg);
    expect(parsed.type).toBe("ERROR");
    expect(parsed.payload.code).toBe("DS_PAGE_NOT_FOUND");
    expect(parsed.payload.message).toBe("Page not found");
    expect(parsed.payload.retryable).toBe(true);
  });

  test("builds error message with retryable=false", () => {
    const msg = error("req-1", "task-1", "DS_SEND_FAILED", "Send failed", false);
    const parsed = parse(msg);
    expect(parsed.payload.retryable).toBe(false);
  });
});
