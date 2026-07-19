import type { AttemptSubmission } from "@/features/product/product-context";

export interface PendingAttemptRequest {
  idempotencyKey: string;
  submission: AttemptSubmission;
  responseTimeMs: number;
}

function snapshotSubmission(submission: AttemptSubmission): AttemptSubmission {
  return submission.kind === "CODE_ORDER"
    ? { kind: "CODE_ORDER", blockIds: [...submission.blockIds] }
    : { kind: submission.kind, text: submission.text };
}

export function createOrReusePendingAttempt(
  existing: PendingAttemptRequest | undefined,
  submission: AttemptSubmission,
  responseTimeMs: number,
  uuid: () => string = () => crypto.randomUUID()
): PendingAttemptRequest {
  if (existing) return existing;
  return {
    idempotencyKey: `attempt-${uuid()}`,
    submission: snapshotSubmission(submission),
    responseTimeMs: Math.max(0, Math.min(3_600_000, Math.round(responseTimeMs)))
  };
}
