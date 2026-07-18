import { describe, expect, it, vi } from "vitest";
import { GenerateContentDto } from "../../apps/api/src/ai-generation/dto/generate-content.dto";
import { ExternalLlmProvider } from "../../apps/api/src/ai-generation/providers/external-llm.provider";
import { LocalTemplateProvider } from "../../apps/api/src/ai-generation/providers/local-template.provider";
import { MockDevelopmentProvider } from "../../apps/api/src/ai-generation/providers/mock-development.provider";
import { DomainRegistryService } from "../../apps/api/src/domains/domain-registry.service";
import { ContentService } from "../../apps/api/src/generated-content/content.service";
import { ContentSourceService } from "../../apps/api/src/generated-content/content-source.service";
import { ContentValidatorService } from "../../apps/api/src/generated-content/content-validator.service";
import { SubmitAttemptDto } from "../../apps/api/src/learning-events/dto/submit-attempt.dto";
import { LearningService } from "../../apps/api/src/learning-events/learning.service";
import type { AiClientService } from "../../apps/api/src/personalization/ai-client.service";
import { FallbackAnalysisService } from "../../apps/api/src/personalization/fallback-analysis.service";
import { DemoStoreService } from "../../apps/api/src/shared/demo-store.service";

describe("EduRecall range misconception workflow", () => {
  it("persists, diagnoses, recommends, generates, reviews, publishes, completes and reuses", async () => {
    const store = new DemoStoreService();
    const offlineAi = { analyze: vi.fn().mockRejectedValue(new Error("offline")) } as unknown as AiClientService;
    const learning = new LearningService(store, offlineAi, new FallbackAnalysisService());
    const attempt = await learning.submitAttempt(Object.assign(new SubmitAttemptDto(), {
      idempotencyKey: "e2e-range-1", studentId: "student-minh", domainCode: "python-foundations", courseId: "course-python",
      conceptCode: "PYTHON_RANGE", isCorrect: false, usedHint: false, skipped: false, attemptNumber: 1,
      difficulty: 0.45, responseTimeMs: 12_500, submittedAnswer: "1,2,3,4,5", expectedAnswer: "1,2,3,4", stopValue: 5, prerequisiteMastery: 0.72
    }));
    expect(attempt.analysis?.diagnosis.misconception_code).toBe("RANGE_STOP_INCLUDED");
    expect(attempt.analysis?.recommendation.action).toBe("MICRO_LESSON");
    expect(attempt.analysis?.recommendation.target?.id).toBe("python_range-range_stop_included-v1");

    const local = new LocalTemplateProvider();
    const content = new ContentService(store, new DomainRegistryService(), local, new ExternalLlmProvider(), new MockDevelopmentProvider(local), new ContentValidatorService(), new ContentSourceService());
    const input = Object.assign(new GenerateContentDto(), {
      domainCode: "python-foundations", conceptCode: "PYTHON_RANGE", misconceptionCode: "RANGE_STOP_INCLUDED",
      level: "Mới bắt đầu", learningObjective: "Biết stop không thuộc dãy", durationMinutes: 5,
      sourceId: "source-python-handbook-01", provider: "LOCAL_TEMPLATE"
    });
    const draft = await content.generate(input);
    content.edit(draft.id, { title: "Range dừng trước vạch đích" });
    content.approve(draft.id, "Checked");
    content.publish(draft.id, "Ready");
    const before = store.getConceptMastery("student-minh", "PYTHON_RANGE", 0);
    const quiz = content.completeQuiz(draft.id, 0);
    expect(quiz.correct).toBe(true);
    expect(Number(quiz.masteryAfter)).toBeGreaterThan(before);
    const reused = await content.generate(input);
    expect(reused.reused).toBe(true);
    expect(reused.reuseCount).toBe(1);
  });
});
