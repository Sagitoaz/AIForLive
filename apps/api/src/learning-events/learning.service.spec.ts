import { AiClientService } from "../personalization/ai-client.service";
import { FallbackAnalysisService } from "../personalization/fallback-analysis.service";
import { DemoStoreService } from "../shared/demo-store.service";
import { SubmitAttemptDto } from "./dto/submit-attempt.dto";
import { LearningService } from "./learning.service";

function dto(key = "attempt-key-1", overrides: Partial<SubmitAttemptDto> = {}): SubmitAttemptDto {
  return Object.assign(new SubmitAttemptDto(), {
    idempotencyKey: key,
    studentId: "student-minh",
    domainCode: "python-foundations",
    courseId: "course-python",
    conceptCode: "PYTHON_RANGE",
    isCorrect: false,
    usedHint: false,
    skipped: false,
    attemptNumber: 1,
    difficulty: 0.45,
    responseTimeMs: 12_500,
    submittedAnswer: "1,2,3,4,5",
    expectedAnswer: "1,2,3,4",
    stopValue: 5,
    prerequisiteMastery: 0.72,
    ...overrides
  });
}

describe("LearningService", () => {
  it("stores the attempt and falls back when Python is unavailable", async () => {
    const store = new DemoStoreService();
    const ai = { analyze: jest.fn().mockRejectedValue(new Error("offline")) } as unknown as AiClientService;
    const service = new LearningService(store, ai, new FallbackAnalysisService());
    const result = await service.submitAttempt(dto());
    expect(result.status).toBe("FALLBACK_ANALYZED");
    expect(result.analysis?.diagnosis.misconception_code).toBe("RANGE_STOP_INCLUDED");
    expect(store.attempts.size).toBe(1);
  });

  it("is idempotent for the same learning event", async () => {
    const store = new DemoStoreService();
    const ai = { analyze: jest.fn().mockRejectedValue(new Error("offline")) } as unknown as AiClientService;
    const service = new LearningService(store, ai, new FallbackAnalysisService());
    const first = await service.submitAttempt(dto("same-key"));
    const second = await service.submitAttempt(dto("same-key"));
    expect(second.id).toBe(first.id);
    expect(store.attempts.size).toBe(1);
    expect(ai.analyze).toHaveBeenCalledTimes(1);
  });

  it("isolates mastery and recent history by student and concept", async () => {
    const store = new DemoStoreService();
    const analyze = jest.fn().mockRejectedValue(new Error("offline"));
    const ai = { analyze } as unknown as AiClientService;
    const service = new LearningService(store, ai, new FallbackAnalysisService());
    const initialMinh = store.getConceptMastery("student-minh", "PYTHON_RANGE");
    const initialLan = store.getConceptMastery("student-lan", "PYTHON_RANGE");

    await service.submitAttempt(dto("minh-range-1", { studentId: "student-minh", usedHint: true }));

    expect(store.getConceptMastery("student-minh", "PYTHON_RANGE")).not.toBe(initialMinh);
    expect(store.getConceptMastery("student-lan", "PYTHON_RANGE")).toBe(initialLan);

    await service.submitAttempt(dto("lan-range-1", { studentId: "student-lan", isCorrect: true }));
    await service.submitAttempt(dto("minh-while-1", {
      studentId: "student-minh",
      conceptCode: "PYTHON_WHILE"
    }));
    await service.submitAttempt(dto("minh-range-2", { studentId: "student-minh" }));

    expect(analyze.mock.calls[0]?.[3]).toEqual([]);
    expect(analyze.mock.calls[1]?.[3]).toEqual([]);
    expect(analyze.mock.calls[2]?.[3]).toEqual([]);
    expect(analyze.mock.calls[3]?.[3]).toEqual([
      expect.objectContaining({
        idempotencyKey: "minh-range-1",
        studentId: "student-minh",
        conceptCode: "PYTHON_RANGE",
        usedHint: true
      })
    ]);
  });
});
