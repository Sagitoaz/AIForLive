import type { LearningAttempt } from "../common/types";
import { SubmitAttemptDto } from "../learning-events/dto/submit-attempt.dto";
import { AiClientService } from "./ai-client.service";
import { FallbackAnalysisService } from "./fallback-analysis.service";

function dto(): SubmitAttemptDto {
  return Object.assign(new SubmitAttemptDto(), {
    idempotencyKey: "current-attempt",
    studentId: "student-minh",
    domainCode: "python-foundations",
    courseId: "course-python",
    conceptCode: "PYTHON_RANGE",
    isCorrect: false,
    usedHint: false,
    skipped: false,
    attemptNumber: 2,
    difficulty: 0.45,
    responseTimeMs: 12_500,
    submittedAnswer: "1,2,3,4,5",
    expectedAnswer: "1,2,3,4",
    stopValue: 5,
    prerequisiteMastery: 0.72
  });
}

describe("AiClientService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("maps only the supplied attempt history into the AI request", async () => {
    const current = dto();
    const fallback = new FallbackAnalysisService();
    const createdAt = "2026-07-18T08:00:00.000Z";
    const previous: LearningAttempt = {
      id: "previous-attempt",
      idempotencyKey: "previous-attempt-key",
      studentId: "student-minh",
      conceptCode: "PYTHON_RANGE",
      isCorrect: false,
      usedHint: true,
      status: "FALLBACK_ANALYZED",
      createdAt,
      analysis: fallback.analyze("previous-attempt", current, 0.42)
    };
    const responseBody = fallback.analyze("current-attempt", current, 0.35);
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(responseBody)
    } as unknown as Response);

    await new AiClientService().analyze("current-attempt", current, 0.35, [previous], {
      stability: 4.2,
      retrievability: 0.31,
      prerequisiteMastery: 0.58,
      courseProgress: 0.41,
      availableMinutes: 30,
      studentGoal: "Tự xây dựng mini game Python"
    });

    const request = fetchMock.mock.calls[0]?.[1];
    const payload = JSON.parse(String(request?.body)) as {
      current_state: { recent_failures: number; last_practiced_at: string; stability: number; retrievability: number };
      prerequisite_mastery: number;
      course_progress: number;
      available_minutes: number;
      student_goal: string;
      recent_history: Array<{
        is_correct: boolean;
        used_hint: boolean;
        occurred_at: string;
        misconception_code: string | null;
      }>;
    };
    expect(payload.current_state).toMatchObject({
      recent_failures: 1,
      last_practiced_at: createdAt,
      stability: 4.2,
      retrievability: 0.31
    });
    expect(payload).toMatchObject({
      prerequisite_mastery: 0.58,
      course_progress: 0.41,
      available_minutes: 30,
      student_goal: "Tự xây dựng mini game Python"
    });
    expect(payload.recent_history).toEqual([{
      is_correct: false,
      used_hint: true,
      occurred_at: createdAt,
      misconception_code: "RANGE_STOP_INCLUDED"
    }]);
  });
});
