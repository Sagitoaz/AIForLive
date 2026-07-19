import { describe, expect, it } from "vitest";
import { createOrReusePendingAttempt } from "./pending-attempt";

describe("createOrReusePendingAttempt", () => {
  it("freezes one transport payload so a network retry cannot double-score with a new key", () => {
    const first = createOrReusePendingAttempt(
      undefined,
      { kind: "PSEUDOCODE", text: "NHẬP n; LẶP; IN kết quả" },
      1_234.6,
      () => "fixed-uuid"
    );
    const retry = createOrReusePendingAttempt(
      first,
      { kind: "PSEUDOCODE", text: "payload mới không được dùng" },
      9_999,
      () => "another-uuid"
    );

    expect(retry).toBe(first);
    expect(retry).toEqual({
      idempotencyKey: "attempt-fixed-uuid",
      submission: { kind: "PSEUDOCODE", text: "NHẬP n; LẶP; IN kết quả" },
      responseTimeMs: 1_235
    });
  });

  it("snapshots block order instead of retaining a mutable array", () => {
    const blockIds = ["b2", "b1"];
    const pending = createOrReusePendingAttempt(undefined, { kind: "CODE_ORDER", blockIds }, 500, () => "blocks");
    blockIds.reverse();

    expect(pending.submission).toEqual({ kind: "CODE_ORDER", blockIds: ["b2", "b1"] });
  });
});
