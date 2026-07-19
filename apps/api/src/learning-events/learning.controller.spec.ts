import { BadRequestException, ValidationPipe } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { LearningController } from "./learning.controller";
import { SubmitAttemptDto } from "./dto/submit-attempt.dto";
import type { LearningService } from "./learning.service";

describe("LearningController authenticated ownership", () => {
  it("passes the JWT user ID explicitly and exposes no client-owned correctness fields", async () => {
    const submitAttempt = jest.fn().mockResolvedValue({ id: "attempt-1" });
    const controller = new LearningController({ submitAttempt } as unknown as LearningService);
    const request = {
      user: {
        id: "student-from-jwt",
        email: "student@example.test",
        displayName: "Student",
        role: "STUDENT"
      }
    } as AuthenticatedRequest;
    const body: SubmitAttemptDto = {
      idempotencyKey: "attempt-key",
      courseId: "course-python",
      activityId: "exercise-range",
      submission: { kind: "PSEUDOCODE", text: "LẶP rồi cộng" },
      usedHint: false,
      skipped: false,
      responseTimeMs: 2_000
    };

    await controller.attempt(request, body);

    expect(submitAttempt).toHaveBeenCalledWith("student-from-jwt", body);
    expect(body).not.toHaveProperty("studentId");
    expect(body).not.toHaveProperty("isCorrect");
    expect(body).not.toHaveProperty("expectedAnswer");
  });

  it("rejects client-owned scoring fields and a missing submission at the DTO boundary", async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const metadata = { type: "body" as const, metatype: SubmitAttemptDto, data: undefined };
    const base = {
      idempotencyKey: "attempt-key",
      courseId: "course-python",
      activityId: "exercise-range",
      submission: { kind: "PSEUDOCODE", text: "LẶP rồi cộng" },
      usedHint: false,
      skipped: false,
      responseTimeMs: 2_000
    };

    await expect(pipe.transform({ ...base, isCorrect: true, expectedAnswer: "trusted-client-value" }, metadata))
      .rejects.toThrow(BadRequestException);
    await expect(pipe.transform({ ...base, submission: undefined }, metadata)).rejects.toThrow();
  });
});
