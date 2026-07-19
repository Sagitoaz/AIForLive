import { LearningEventStatus, LessonPhase } from "@prisma/client";
import type { AnalysisResult } from "../common/types";
import type { PrismaService } from "../database/prisma.service";
import type { AiClientService } from "../personalization/ai-client.service";
import { FallbackAnalysisService } from "../personalization/fallback-analysis.service";
import type { ExerciseGraderService } from "./exercise-grader.service";
import { LearningService } from "./learning.service";

function personalization(): AnalysisResult {
  return {
    event_id: "event-1",
    model_version: "bkt-test-v1",
    mastery_before: 0.3,
    mastery_after: 0.52,
    observation_confidence: 0.8,
    retrievability: 0.6,
    forgetting_risk: 0.4,
    recommended_interval_days: 3,
    next_attempt_probability: 0.58,
    diagnosis: {
      status: "NEED_MORE_EVIDENCE",
      concept_code: "PYTHON_FOR",
      misconception_code: null,
      confidence: 0.2,
      source: "FALLBACK",
      rule_id: null,
      evidence: ["One formative observation"]
    },
    recommendation: {
      action: "PRACTICE_SET",
      priority_score: 0.7,
      reasons: ["Cần thêm một lượt thực hành"],
      evidence: { attemptIds: ["event-1"], candidateScores: { knowledgeGap: 0.48 } },
      target: {
        type: "ACTIVITY",
        id: "semantic-practice",
        title: "Luyện vòng lặp",
        phase: "PRACTICE",
        estimated_minutes: 8,
        difficulty: 0.5
      }
    },
    explanations: ["Formative personalization"],
    mode: "AI_SERVICE"
  };
}

describe("LearningService graded-attempt persistence", () => {
  it("persists the server-computed formative score and grading trace before personalization", async () => {
    const learningEventCreate = jest.fn().mockResolvedValue({
      id: "event-1",
      idempotencyKey: "idea-attempt-key",
      userId: "student-from-jwt",
      courseId: "course-python",
      type: "EXERCISE",
      status: LearningEventStatus.PENDING_ANALYSIS,
      occurredAt: new Date("2026-07-19T00:00:00.000Z"),
      createdAt: new Date("2026-07-19T00:00:00.000Z"),
      metadataJson: {},
      attempt: { id: "attempt-1" }
    });
    const prisma = {
      learningEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: learningEventCreate,
        update: jest.fn()
      },
      exercise: {
        findFirst: jest.fn().mockResolvedValue({
          id: "exercise-idea",
          code: "IDEA-FOR-1",
          prompt: "Mô tả ý tưởng lặp qua danh sách",
          type: "PSEUDOCODE",
          phase: LessonPhase.PRACTICE,
          difficulty: 0.55,
          contentJson: { responseMode: "PSEUDOCODE" },
          answerJson: { teacherReviewed: true, strategy: "IDEA_RUBRIC" },
          lesson: {
            id: "lesson-for",
            title: "Vòng lặp for",
            durationMinutes: 20,
            concept: { id: "concept-for", code: "PYTHON_FOR", domainId: "domain-python" },
            module: {
              course: {
                id: "course-python",
                domain: { code: "python-foundations" }
              }
            }
          }
        }),
        findMany: jest.fn().mockResolvedValue([])
      },
      enrollment: {
        findFirst: jest.fn().mockResolvedValue({
          courseId: "course-python",
          studentProfileId: "profile-jwt",
          progress: 0.35,
          student: { learningGoal: "Tạo mini game", weeklyAvailabilityMinutes: 120 }
        })
      },
      studentConceptState: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      attempt: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      conceptPrerequisite: { findMany: jest.fn().mockResolvedValue([]) },
      misconception: { findFirst: jest.fn().mockResolvedValue(null) },
      recommendation: { create: jest.fn() },
      attemptDiagnosis: { create: jest.fn() },
      conceptStateHistory: { create: jest.fn() },
      reviewSchedule: { create: jest.fn() },
      personalizationRun: { create: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([])
    };
    const grading = {
      strategy: "IDEA_RUBRIC" as const,
      mode: "EXTERNAL_LLM" as const,
      score: 0.75,
      passThreshold: 0.7,
      confidence: 0.86,
      rubricVersion: "for-idea-v1",
      criteria: [{
        id: "iterate",
        coverage: 0.75,
        evidence: ["LẶP từng phần tử"],
        feedback: "Đã có ý tưởng lặp."
      }],
      feedback: "Ý tưởng đạt ngưỡng luyện tập.",
      trace: {
        provider: "EXTERNAL_CHAT_COMPLETIONS",
        model: "DeepSeek-V4-Flash",
        promptVersion: "idea-rubric-v1",
        promptHash: "a".repeat(64),
        promptTokens: 100,
        completionTokens: 40,
        estimatedCostUsd: 0.0001,
        latencyMs: 250
      }
    };
    const grader = {
      grade: jest.fn().mockResolvedValue({
        isCorrect: true,
        score: 0.75,
        grading,
        submittedAnswer: "LẶP từng phần tử rồi xử lý",
        expectedAnswer: "Lặp qua từng phần tử"
      })
    };
    const ai = { analyze: jest.fn().mockResolvedValue(personalization()) };
    const service = new LearningService(
      prisma as unknown as PrismaService,
      ai as unknown as AiClientService,
      new FallbackAnalysisService(),
      grader as unknown as ExerciseGraderService
    );

    const outcome = await service.submitAttempt("student-from-jwt", {
      idempotencyKey: "idea-attempt-key",
      courseId: "course-python",
      activityId: "exercise-idea",
      submission: { kind: "PSEUDOCODE", text: "LẶP từng phần tử rồi xử lý" },
      usedHint: false,
      skipped: false,
      responseTimeMs: 4_000
    });

    const createInput = learningEventCreate.mock.calls[0]![0];
    expect(createInput.data.userId).toBe("student-from-jwt");
    expect(createInput.data.attempt.create).toMatchObject({
      userId: "student-from-jwt",
      isCorrect: true,
      score: 0.75,
      submittedJson: { kind: "PSEUDOCODE", text: "LẶP từng phần tử rồi xử lý" },
      metadataJson: {
        scoring: "EXTERNAL_LLM",
        grading: expect.objectContaining({ rubricVersion: "for-idea-v1", trace: expect.any(Object) })
      }
    });
    expect(ai.analyze).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({
        studentId: "student-from-jwt",
        domainCode: "python-foundations",
        conceptCode: "PYTHON_FOR",
        difficulty: 0.55,
        isCorrect: true,
        expectedAnswer: "Lặp qua từng phần tử"
      }),
      0.3,
      [],
      expect.any(Object)
    );
    expect(outcome).toMatchObject({
      id: "attempt-1",
      studentId: "student-from-jwt",
      isCorrect: true,
      grading: { mode: "EXTERNAL_LLM", score: 0.75 }
    });
  });
});
