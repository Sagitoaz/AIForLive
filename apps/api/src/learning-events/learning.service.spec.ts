import { LessonPhase } from "@prisma/client";
import type { AnalysisResult } from "../common/types";
import { PrismaService } from "../database/prisma.service";
import { AiClientService } from "../personalization/ai-client.service";
import { FallbackAnalysisService } from "../personalization/fallback-analysis.service";
import { LearningService } from "./learning.service";

type Target = NonNullable<AnalysisResult["recommendation"]["target"]>;

interface ResolverContext {
  courseId: string;
  conceptId: string;
  currentLesson: { id: string; title: string; durationMinutes: number };
  currentExercise: { id: string; prompt: string; phase: LessonPhase; difficulty: number };
}

interface ResolverHarness {
  resolveRecommendationTarget(
    analysis: AnalysisResult,
    context: ResolverContext
  ): Promise<{
    target: Target;
    metadata: {
      source: string;
      entityType: string;
      entityId: string;
      originalSemanticTargetId: string | null;
    };
  }>;
}

function analysis(action: string, target: Target): AnalysisResult {
  return {
    event_id: "event-1",
    model_version: "test-v1",
    mastery_before: 0.4,
    mastery_after: 0.45,
    observation_confidence: 0.8,
    retrievability: 0.5,
    forgetting_risk: 0.5,
    recommended_interval_days: 2,
    next_attempt_probability: 0.48,
    diagnosis: {
      status: "MATCHED",
      concept_code: "PYTHON_RANGE",
      misconception_code: "RANGE_STOP_INCLUDED",
      confidence: 0.9,
      source: "DOMAIN_RULE",
      rule_id: "range-stop-rule-v1",
      evidence: ["AI evidence remains unchanged"]
    },
    recommendation: {
      action,
      priority_score: 0.8,
      reasons: ["AI reason remains unchanged"],
      evidence: { candidateScores: { knowledgeGap: 0.6 } },
      target
    },
    explanations: ["AI explanation remains unchanged"],
    mode: "AI_SERVICE"
  };
}

function context(): ResolverContext {
  return {
    courseId: "course-real",
    conceptId: "concept-range-real",
    currentLesson: { id: "lesson-current-real", title: "Khám phá range()", durationMinutes: 18 },
    currentExercise: {
      id: "exercise-current-real",
      prompt: "Dự đoán kết quả range(1, 5)",
      phase: LessonPhase.PRACTICE,
      difficulty: 0.45
    }
  };
}

function service(prisma: {
  microLesson?: { findFirst: jest.Mock };
  lesson?: { findFirst: jest.Mock; findMany: jest.Mock };
  exercise?: { findMany: jest.Mock };
}): ResolverHarness {
  const learning = new LearningService(
    prisma as unknown as PrismaService,
    {} as AiClientService,
    new FallbackAnalysisService()
  );
  return learning as unknown as ResolverHarness;
}

describe("LearningService recommendation target resolver", () => {
  it("replaces a semantic micro-lesson id with a published Supabase MicroLesson id", async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: "micro-lesson-published-real",
      title: "Stop không thuộc range()",
      durationMinutes: 7
    });
    const resolver = service({ microLesson: { findFirst } });
    const input = analysis("MICRO_LESSON", {
      type: "MICRO_LESSON",
      id: "python_range-range_stop_included-v1",
      title: "Semantic target",
      phase: "THEORY",
      estimated_minutes: 5,
      difficulty: 0.35
    });

    const resolved = await resolver.resolveRecommendationTarget(input, context());

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        conceptId: "concept-range-real",
        status: "PUBLISHED",
        generatedContent: expect.objectContaining({ generationJob: { courseId: "course-real" } })
      })
    }));
    expect(resolved.target).toMatchObject({
      type: "MICRO_LESSON",
      id: "micro-lesson-published-real",
      title: "Stop không thuộc range()"
    });
    expect(resolved.metadata).toEqual({
      source: "PUBLISHED_MICRO_LESSON",
      entityType: "MicroLesson",
      entityId: "micro-lesson-published-real",
      originalSemanticTargetId: "python_range-range_stop_included-v1"
    });
    expect(input.recommendation.evidence).toEqual({ candidateScores: { knowledgeGap: 0.6 } });
  });

  it("resolves practice recommendations to an active exercise in the same concept and course", async () => {
    const findMany = jest.fn().mockResolvedValue([{
      id: "exercise-guided-real",
      prompt: "Sửa đoạn code để range() không chứa stop.",
      phase: LessonPhase.PRACTICE,
      difficulty: 0.4,
      lesson: { durationMinutes: 16 }
    }]);
    const resolver = service({ exercise: { findMany } });

    const resolved = await resolver.resolveRecommendationTarget(analysis("PRACTICE_SET", {
      type: "ACTIVITY",
      id: "python_range-guided-practice",
      title: "Semantic activity",
      phase: "PRACTICE",
      estimated_minutes: 10
    }), context());

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        phase: LessonPhase.PRACTICE,
        status: "ACTIVE",
        lesson: expect.objectContaining({ conceptId: "concept-range-real" })
      })
    }));
    expect(resolved.target).toMatchObject({
      type: "ACTIVITY",
      id: "exercise-guided-real",
      phase: "PRACTICE",
      difficulty: 0.4
    });
    expect(resolved.metadata.source).toBe("ACTIVE_EXERCISE");
  });

  it("uses the already validated current exercise when no matching activity exists", async () => {
    const resolver = service({ exercise: { findMany: jest.fn().mockResolvedValue([]) } });

    const resolved = await resolver.resolveRecommendationTarget(analysis("CHECKPOINT", {
      type: "ACTIVITY",
      id: "python_range-checkpoint",
      title: "Semantic checkpoint",
      phase: "CHECKPOINT",
      estimated_minutes: 8
    }), context());

    expect(resolved.target).toMatchObject({
      type: "ACTIVITY",
      id: "exercise-current-real",
      phase: "PRACTICE"
    });
    expect(resolved.metadata).toMatchObject({
      source: "CURRENT_EXERCISE",
      entityType: "Exercise",
      entityId: "exercise-current-real",
      originalSemanticTargetId: "python_range-checkpoint"
    });
  });

  it("resolves continue-path to the next active lesson in course order", async () => {
    const resolver = service({
      lesson: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          { id: "lesson-current-real", title: "Khám phá range()", durationMinutes: 18 },
          { id: "lesson-next-real", title: "Vòng lặp for", durationMinutes: 20 }
        ])
      }
    });

    const resolved = await resolver.resolveRecommendationTarget(analysis("CONTINUE_PATH", {
      type: "LESSON_PHASE",
      id: "python_range-next-lesson",
      title: "Semantic next lesson",
      phase: "THEORY",
      estimated_minutes: 20
    }), context());

    expect(resolved.target).toMatchObject({
      type: "LESSON_PHASE",
      id: "lesson-next-real",
      title: "Vòng lặp for",
      phase: "THEORY"
    });
    expect(resolved.metadata.source).toBe("ACTIVE_LESSON");
  });
});
