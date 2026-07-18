import { describe, expect, it } from "vitest";
import { GenerateContentDto } from "../../apps/api/src/ai-generation/dto/generate-content.dto";
import { ExternalLlmProvider } from "../../apps/api/src/ai-generation/providers/external-llm.provider";
import { LocalTemplateProvider } from "../../apps/api/src/ai-generation/providers/local-template.provider";
import { MockDevelopmentProvider } from "../../apps/api/src/ai-generation/providers/mock-development.provider";
import { DomainRegistryService } from "../../apps/api/src/domains/domain-registry.service";
import { ContentService } from "../../apps/api/src/generated-content/content.service";
import { ContentValidatorService } from "../../apps/api/src/generated-content/content-validator.service";
import { LessonExportService } from "../../apps/api/src/generated-content/lesson-export.service";
import { DemoStoreService } from "../../apps/api/src/shared/demo-store.service";
import type { FinalAssessment } from "../../apps/api/src/common/types";

const STUDENT = "student-minh";

function correctAnswers(assessment: FinalAssessment) {
  return assessment.questions.map((question) =>
    question.options && typeof question.correctIndex === "number"
      ? { questionId: question.id, selectedIndex: question.correctIndex }
      : { questionId: question.id, answer: question.expectedAnswer }
  );
}

describe("E2E-LESSON-THREE-PART-COMPLETE", () => {
  it("runs teacher → AI three parts → review → publish → student → fail → recommend → retry → pass → complete", async () => {
    const store = new DemoStoreService();
    const local = new LocalTemplateProvider();
    const content = new ContentService(store, new DomainRegistryService(), local, new ExternalLlmProvider(), new MockDevelopmentProvider(local), new ContentValidatorService());
    const exporter = new LessonExportService();

    // Teacher creates a lesson; AI must generate all three parts.
    const input = Object.assign(new GenerateContentDto(), {
      domainCode: "python-foundations", conceptCode: "PYTHON_RANGE", misconceptionCode: "RANGE_STOP_INCLUDED",
      level: "Lớp 6 mới bắt đầu", learningObjective: "Biết stop không thuộc dãy", durationMinutes: 5,
      sourceId: "source-python-handbook-01", provider: "LOCAL_TEMPLATE"
    });
    const draft = await content.generate(input);
    expect(draft.sections.map((s) => s.type).sort()).toEqual(["FINAL_ASSESSMENT", "PRACTICE", "THEORY"]);
    expect(draft.status).toBe("DRAFT");

    // Teacher edits theory, then reviews, approves and publishes.
    content.edit(draft.id, { title: "Dừng đúng lúc với range() — ba phần" });
    content.approve(draft.id, "Đủ ba phần và có answer key");
    const published = content.publish(draft.id, "Ready");
    expect(published.status).toBe("PUBLISHED");

    const assessment = published.sections.find((s) => s.type === "FINAL_ASSESSMENT")!.assessment!;

    // Student learns theory and practice.
    content.recordSectionProgress(published.id, "THEORY", { completed: true });
    content.recordSectionProgress(published.id, "PRACTICE", { completed: true });

    // Student fails the final assessment first → knowledge gap + recommendation.
    const failed = content.submitFinalAssessment(published.id, assessment.questions.map((q) => ({ questionId: q.id, selectedIndex: 99, answer: "sai" })), STUDENT);
    expect(failed.passed).toBe(false);
    expect((failed.knowledgeGaps as string[]).length).toBeGreaterThan(0);
    expect((failed.recommendations as unknown[]).length).toBeGreaterThan(0);
    expect(failed.lessonComplete).toBe(false);

    const masteryBefore = store.getConceptMastery(STUDENT, "PYTHON_RANGE", 0.42);

    // Student retries and passes → mastery updates, lesson completes.
    const passed = content.submitFinalAssessment(published.id, correctAnswers(assessment), STUDENT);
    expect(passed.passed).toBe(true);
    expect(passed.lessonComplete).toBe(true);
    const masteryAfter = store.getConceptMastery(STUDENT, "PYTHON_RANGE", 0.42);
    expect(masteryAfter).toBeGreaterThan(masteryBefore);

    // HTML export contains all three parts and is safe/standalone.
    const { html } = exporter.build(published);
    expect(html).toContain('id="theory"');
    expect(html).toContain('id="practice"');
    expect(html).toContain('id="final"');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("https://");

    // Final progress snapshot.
    const progress = content.lessonProgress(published.id, STUDENT);
    expect(progress.lessonComplete).toBe(true);
  });
});
