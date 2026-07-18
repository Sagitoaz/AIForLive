import { GenerateContentDto } from "../ai-generation/dto/generate-content.dto";
import { ExternalLlmProvider } from "../ai-generation/providers/external-llm.provider";
import { LocalTemplateProvider } from "../ai-generation/providers/local-template.provider";
import { MockDevelopmentProvider } from "../ai-generation/providers/mock-development.provider";
import { DomainRegistryService } from "../domains/domain-registry.service";
import { DemoStoreService } from "../shared/demo-store.service";
import { ContentService } from "./content.service";
import { ContentValidatorService } from "./content-validator.service";
import { LessonExportService } from "./lesson-export.service";
import type { FinalAssessment } from "../common/types";

function makeService(): { content: ContentService; store: DemoStoreService } {
  const store = new DemoStoreService();
  const local = new LocalTemplateProvider();
  const mock = new MockDevelopmentProvider(local);
  const content = new ContentService(store, new DomainRegistryService(), local, new ExternalLlmProvider(), mock, new ContentValidatorService());
  return { content, store };
}

function input(): GenerateContentDto {
  return Object.assign(new GenerateContentDto(), {
    domainCode: "python-foundations",
    conceptCode: "PYTHON_RANGE",
    misconceptionCode: "RANGE_STOP_INCLUDED",
    level: "Lớp 6 mới bắt đầu",
    learningObjective: "Biết rằng stop không thuộc dãy",
    durationMinutes: 5,
    sourceId: "source-python-handbook-01",
    provider: "LOCAL_TEMPLATE"
  });
}

async function publishedLesson(content: ContentService) {
  const draft = await content.generate(input());
  content.approve(draft.id, "Đủ ba phần");
  content.publish(draft.id, "Ready");
  return content.getPublished(draft.id);
}

function correctAnswers(assessment: FinalAssessment) {
  return assessment.questions.map((question) =>
    question.options && typeof question.correctIndex === "number"
      ? { questionId: question.id, selectedIndex: question.correctIndex }
      : { questionId: question.id, answer: question.expectedAnswer }
  );
}

function wrongAnswers(assessment: FinalAssessment) {
  return assessment.questions.map((question) => ({ questionId: question.id, selectedIndex: 99, answer: "sai" }));
}

const STUDENT = "student-minh";

describe("FEATURE-016 teacher workflow", () => {
  it("REVIEW-INCOMPLETE-LESSON-REJECTED blocks approval when a section is empty", async () => {
    const { content, store } = makeService();
    const draft = await content.generate(input());
    const stored = store.contents.get(draft.id)!;
    stored.sections = stored.sections.filter((section) => section.type !== "FINAL_ASSESSMENT");
    expect(() => content.approve(draft.id)).toThrow(/FINAL_ASSESSMENT/);
  });

  it("REVIEW-EDIT-RESET-APPROVAL forces re-review after editing an approved lesson", async () => {
    const { content } = makeService();
    const draft = await content.generate(input());
    content.approve(draft.id, "ok");
    const edited = content.edit(draft.id, { title: "Tiêu đề mới" });
    expect(edited.status).toBe("REVISION_REQUIRED");
    expect(edited.reviewHistory.some((entry) => entry.action === "EDIT_RESET_APPROVAL")).toBe(true);
  });

  it("TEACHER sections expose all three parts for editing", async () => {
    const { content } = makeService();
    const draft = await content.generate(input());
    const sections = content.getSections(draft.id);
    expect(sections.find((s) => s.type === "THEORY")?.resources?.length).toBeGreaterThan(0);
    expect(sections.find((s) => s.type === "PRACTICE")?.activities?.length).toBeGreaterThan(0);
    expect(sections.find((s) => s.type === "FINAL_ASSESSMENT")?.assessment?.questions.length).toBeGreaterThan(0);
  });
});

describe("FEATURE-016 student workflow", () => {
  it("STUDENT-THEORY-PROGRESS and STUDENT-PRACTICE-PROGRESS are stored separately", async () => {
    const { content } = makeService();
    const lesson = await publishedLesson(content);
    const theory = content.recordSectionProgress(lesson.id, "THEORY", { completed: true });
    const practice = content.recordSectionProgress(lesson.id, "PRACTICE", { completed: true });
    expect(theory.status).toBe("COMPLETED");
    expect(practice.status).toBe("COMPLETED");
    expect(theory.sectionType).not.toBe(practice.sectionType);
  });

  it("STUDENT-LESSON-NOT-COMPLETE-WITHOUT-ASSESSMENT blocks the final assessment until earlier parts are done", async () => {
    const { content } = makeService();
    const lesson = await publishedLesson(content);
    const assessment = lesson.sections.find((s) => s.type === "FINAL_ASSESSMENT")!.assessment!;
    expect(() => content.submitFinalAssessment(lesson.id, correctAnswers(assessment), STUDENT)).toThrow(/Theory and Practice/);
  });

  it("STUDENT-FINAL-ASSESSMENT and STUDENT-LESSON-COMPLETE-AFTER-PASS", async () => {
    const { content } = makeService();
    const lesson = await publishedLesson(content);
    content.recordSectionProgress(lesson.id, "THEORY", { completed: true });
    content.recordSectionProgress(lesson.id, "PRACTICE", { completed: true });
    const assessment = lesson.sections.find((s) => s.type === "FINAL_ASSESSMENT")!.assessment!;
    const result = content.submitFinalAssessment(lesson.id, correctAnswers(assessment), STUDENT);
    expect(result.passed).toBe(true);
    expect(result.lessonComplete).toBe(true);
    const progress = content.lessonProgress(lesson.id, STUDENT);
    expect(progress.lessonComplete).toBe(true);
  });
});

describe("FEATURE-016 mastery and recommendations", () => {
  it("ASSESSMENT-UPDATES-MASTERY using the final assessment as primary evidence", async () => {
    const { content, store } = makeService();
    const lesson = await publishedLesson(content);
    content.recordSectionProgress(lesson.id, "THEORY", { completed: true });
    content.recordSectionProgress(lesson.id, "PRACTICE", { completed: true });
    const before = store.getConceptMastery(STUDENT, "PYTHON_RANGE", 0.42);
    const assessment = lesson.sections.find((s) => s.type === "FINAL_ASSESSMENT")!.assessment!;
    content.submitFinalAssessment(lesson.id, correctAnswers(assessment), STUDENT);
    const after = store.getConceptMastery(STUDENT, "PYTHON_RANGE", 0.42);
    expect(after).toBeGreaterThan(before);
  });

  it("ASSESSMENT-DETECTS-KNOWLEDGE-GAP and ASSESSMENT-CREATES-RECOMMENDATION on failure", async () => {
    const { content, store } = makeService();
    const lesson = await publishedLesson(content);
    content.recordSectionProgress(lesson.id, "THEORY", { completed: true });
    content.recordSectionProgress(lesson.id, "PRACTICE", { completed: true });
    const assessment = lesson.sections.find((s) => s.type === "FINAL_ASSESSMENT")!.assessment!;
    const result = content.submitFinalAssessment(lesson.id, wrongAnswers(assessment), STUDENT);
    expect(result.passed).toBe(false);
    expect((result.knowledgeGaps as string[]).length).toBeGreaterThan(0);
    expect((result.recommendations as unknown[]).length).toBeGreaterThan(0);
    expect(store.recommendationsForStudent(STUDENT).length).toBeGreaterThan(0);
    expect(result.lessonComplete).toBe(false);
  });

  it("ASSESSMENT-RETRY-IDEMPOTENT grades the same answers identically and counts attempts", async () => {
    const { content } = makeService();
    const lesson = await publishedLesson(content);
    content.recordSectionProgress(lesson.id, "THEORY", { completed: true });
    content.recordSectionProgress(lesson.id, "PRACTICE", { completed: true });
    const assessment = lesson.sections.find((s) => s.type === "FINAL_ASSESSMENT")!.assessment!;
    const first = content.submitFinalAssessment(lesson.id, correctAnswers(assessment), STUDENT);
    const second = content.submitFinalAssessment(lesson.id, correctAnswers(assessment), STUDENT);
    expect(second.score).toBe(first.score);
    expect(second.passed).toBe(first.passed);
    expect(second.attempts).toBe((first.attempts as number) + 1);
  });
});

describe("FEATURE-016 export", () => {
  const exporter = new LessonExportService();

  it("EXPORT-CONTAINS-THEORY/PRACTICE/FINAL and is standalone + safe", async () => {
    const { content } = makeService();
    const lesson = await publishedLesson(content);
    const { html, filename } = exporter.build(lesson);
    expect(filename.endsWith(".html")).toBe(true);
    expect(html).toContain('id="theory"');
    expect(html).toContain('id="practice"');
    expect(html).toContain('id="final"');
    expect(html.startsWith("<!doctype html>")).toBe(true);
    // EXPORT-SAFE / EXPORT-STANDALONE
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("http://");
    expect(html).not.toContain("https://");
  });
});
