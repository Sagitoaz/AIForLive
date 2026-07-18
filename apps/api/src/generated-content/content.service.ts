import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { DemoContent, LessonSection, LessonSectionType, SectionProgress } from "../common/types";
import type { GenerateContentDto } from "../ai-generation/dto/generate-content.dto";
import { ExternalLlmProvider } from "../ai-generation/providers/external-llm.provider";
import { LocalTemplateProvider } from "../ai-generation/providers/local-template.provider";
import { MockDevelopmentProvider } from "../ai-generation/providers/mock-development.provider";
import { DomainRegistryService } from "../domains/domain-registry.service";
import { DemoStoreService } from "../shared/demo-store.service";
import { ContentValidatorService } from "./content-validator.service";
import type { EditContentDto } from "./dto/review-content.dto";
import { buildSectionsFromLegacy, buildSectionsFromOutput, gradeFinalAssessment } from "./lesson-sections";

@Injectable()
export class ContentService {
  constructor(
    private readonly store: DemoStoreService,
    private readonly domains: DomainRegistryService,
    private readonly local: LocalTemplateProvider,
    private readonly external: ExternalLlmProvider,
    private readonly mock: MockDevelopmentProvider,
    private readonly validator: ContentValidatorService
  ) {}

  async generate(input: GenerateContentDto): Promise<DemoContent & { reused: boolean }> {
    if (!this.domains.hasConcept(input.domainCode, input.conceptCode)) {
      throw new BadRequestException("Concept is not registered in this domain");
    }
    if (!this.domains.hasMisconception(input.domainCode, input.misconceptionCode)) {
      throw new BadRequestException("Misconception is not registered in this domain");
    }
    const reusable = [...this.store.contents.values()].find(
      (content) =>
        content.status === "PUBLISHED" &&
        content.domainCode === input.domainCode &&
        content.conceptCode === input.conceptCode &&
        content.misconceptionCode === input.misconceptionCode
    );
    if (reusable) {
      reusable.reuseCount += 1;
      reusable.updatedAt = new Date().toISOString();
      return { ...reusable, reused: true };
    }
    const provider = input.provider === "EXTERNAL_LLM" ? this.external : input.provider === "MOCK_DEVELOPMENT" ? this.mock : this.local;
    const output = await provider.generate(input);
    this.validator.validate(output);
    const now = new Date().toISOString();
    const content: DemoContent = {
      id: randomUUID(),
      title: output.title,
      domainCode: input.domainCode,
      conceptCode: input.conceptCode,
      misconceptionCode: input.misconceptionCode,
      level: input.level,
      objectives: output.objectives,
      sourceReferences: output.sourceReferences,
      slides: output.slides,
      quiz: output.quiz,
      sections: buildSectionsFromOutput(output),
      status: "DRAFT",
      provider: output.provider,
      reuseCount: 0,
      version: 1,
      generationMs: output.generationMs,
      estimatedCostUsd: output.estimatedCostUsd,
      reviewHistory: [],
      updatedAt: now
    };
    this.store.contents.set(content.id, content);
    return { ...content, reused: false };
  }

  listForTeacher(): DemoContent[] {
    return [...this.store.contents.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  getForTeacher(id: string): DemoContent {
    const content = this.store.contents.get(id);
    if (!content) throw new NotFoundException("Generated content not found");
    return this.ensureSections(content);
  }

  /**
   * FEATURE-016 backward compatibility: lessons created before the three-part
   * structure only have `slides` + `quiz`. Derive sections on read without
   * losing any data and without auto-publishing migrated content.
   */
  private ensureSections(content: DemoContent): DemoContent {
    if (!content.sections || content.sections.length === 0) {
      content.sections = buildSectionsFromLegacy({
        slides: content.slides,
        quiz: content.quiz,
        conceptCode: content.conceptCode,
        status: content.status
      });
      this.store.contents.set(content.id, content);
    }
    return content;
  }

  getSections(id: string): LessonSection[] {
    return this.getForTeacher(id).sections;
  }

  getPublished(id: string): DemoContent {
    const content = this.getForTeacher(id);
    if (content.status !== "PUBLISHED") throw new NotFoundException("Published micro-lesson not found");
    return content;
  }

  edit(id: string, input: EditContentDto): DemoContent {
    const content = this.getForTeacher(id);
    if (["PUBLISHED", "ARCHIVED", "REJECTED"].includes(content.status)) {
      throw new BadRequestException("This status cannot be edited");
    }
    if (input.title) content.title = input.title;
    if (input.slides) {
      const edits = new Map(input.slides.map((slide) => [slide.id, slide]));
      content.slides = content.slides.map((slide) => {
        const edit = edits.get(slide.id);
        return edit ? { ...slide, title: edit.title, body: edit.body, narration: edit.narration } : slide;
      });
    }
    if (input.quiz) {
      if (input.quiz.correctIndex >= input.quiz.options.length) throw new BadRequestException("Quiz answer index is invalid");
      content.quiz = { ...input.quiz };
    }
    // FEATURE-016 review workflow: editing any part after approval bumps the
    // version, resets approval and forces a fresh human review.
    const editedFromApproved = content.status === "APPROVED" || content.status === "IN_REVIEW";
    if (editedFromApproved) {
      content.status = "REVISION_REQUIRED";
      content.reviewHistory.push({ action: "EDIT_RESET_APPROVAL", from: "APPROVED", to: "REVISION_REQUIRED", at: new Date().toISOString() });
    }
    content.version += 1;
    content.updatedAt = new Date().toISOString();
    this.store.contents.set(content.id, content);
    return content;
  }

  submitReview(id: string, comment?: string): DemoContent {
    return this.transition(id, "IN_REVIEW", "SUBMIT_REVIEW", comment, ["DRAFT", "REVISION_REQUIRED"]);
  }

  approve(id: string, comment?: string): DemoContent {
    const content = this.getForTeacher(id);
    // FEATURE-016: a lesson cannot be approved unless all three parts are complete.
    this.assertThreePartComplete(content);
    const from = content.status;
    if (from === "DRAFT") content.status = "IN_REVIEW";
    return this.transition(id, "APPROVED", "APPROVE", comment, ["IN_REVIEW"]);
  }

  private assertThreePartComplete(content: DemoContent): void {
    const types: LessonSectionType[] = ["THEORY", "PRACTICE", "FINAL_ASSESSMENT"];
    for (const type of types) {
      if (!content.sections.some((section) => section.type === type)) {
        throw new BadRequestException(`Lesson is missing the ${type} section and cannot be approved`);
      }
    }
    const theory = content.sections.find((section) => section.type === "THEORY");
    if (!theory?.resources?.length) {
      throw new BadRequestException("Theory section is empty and cannot be approved");
    }
    const practice = content.sections.find((section) => section.type === "PRACTICE");
    if (!practice?.activities?.length) {
      throw new BadRequestException("Practice section has no activities and cannot be approved");
    }
    const assessment = content.sections.find((section) => section.type === "FINAL_ASSESSMENT")?.assessment;
    if (!assessment?.questions.length) {
      throw new BadRequestException("Final assessment has no questions and cannot be approved");
    }
    if (assessment.questions.some((question) =>
      !(question.options && typeof question.correctIndex === "number") && !question.expectedAnswer?.trim()
    )) {
      throw new BadRequestException("Every assessment question needs an answer key before approval");
    }
  }

  reject(id: string, comment?: string): DemoContent {
    return this.transition(id, "REJECTED", "REJECT", comment, ["IN_REVIEW"]);
  }

  requestRevision(id: string, comment?: string): DemoContent {
    return this.transition(id, "REVISION_REQUIRED", "REQUEST_REVISION", comment, ["IN_REVIEW"]);
  }

  publish(id: string, comment?: string): DemoContent {
    return this.transition(id, "PUBLISHED", "PUBLISH", comment, ["APPROVED"]);
  }

  completeQuiz(id: string, selectedIndex: number, studentId = "student-minh"): Record<string, unknown> {
    const content = this.getPublished(id);
    const correct = selectedIndex === content.quiz.correctIndex;
    const before = this.store.getConceptMastery(studentId, content.conceptCode, 0.42);
    const after = Math.max(0.02, Math.min(0.98, before + (correct ? 0.14 : -0.04)));
    this.store.setConceptMastery(studentId, content.conceptCode, after);
    return {
      correct,
      explanation: content.quiz.explanation,
      masteryBefore: before,
      masteryAfter: Number(after.toFixed(4)),
      nextReviewIntervalDays: correct ? 5 : 1,
      xpEarned: correct ? 40 : 12
    };
  }

  /* -------------------------------------------------------------- */
  /* FEATURE-016 — section progress, final assessment, completion    */
  /* -------------------------------------------------------------- */

  recordSectionProgress(
    id: string,
    sectionType: LessonSectionType,
    input: { progressPercent?: number; completed?: boolean; studentId?: string }
  ): SectionProgress {
    const content = this.getPublished(id);
    const section = content.sections.find((entry) => entry.type === sectionType);
    if (!section) throw new BadRequestException(`Section ${sectionType} does not exist on this lesson`);
    if (sectionType === "FINAL_ASSESSMENT") {
      throw new BadRequestException("Use the final-assessment endpoint to record assessment results");
    }
    const studentId = input.studentId ?? "student-minh";
    const existing = this.store.getSectionProgress(studentId, id, sectionType);
    const progressPercent = Math.max(0, Math.min(100, Math.round(input.progressPercent ?? existing?.progressPercent ?? 0)));
    const completed = input.completed ?? progressPercent >= 100;
    const progress: SectionProgress = {
      studentId,
      contentId: id,
      sectionType,
      status: completed ? "COMPLETED" : progressPercent > 0 ? "IN_PROGRESS" : "NOT_STARTED",
      progressPercent: completed ? 100 : progressPercent,
      attempts: (existing?.attempts ?? 0) + 1,
      ...(completed ? { completedAt: new Date().toISOString() } : {})
    };
    this.store.setSectionProgress(progress);
    return progress;
  }

  submitFinalAssessment(
    id: string,
    answers: Array<{ questionId: string; selectedIndex?: number; answer?: string }>,
    studentId = "student-minh"
  ): Record<string, unknown> {
    const content = this.getPublished(id);
    const section = content.sections.find((entry) => entry.type === "FINAL_ASSESSMENT");
    const assessment = section?.assessment;
    if (!assessment || assessment.questions.length === 0) {
      throw new BadRequestException("This lesson does not have a final assessment yet; a teacher must add one");
    }

    // A student cannot take the final assessment until the earlier sections are done.
    const gate = this.completionGate(content, studentId);
    if (!gate.theoryDone || !gate.practiceDone) {
      throw new BadRequestException("Complete Theory and Practice before the final assessment");
    }

    const grade = gradeFinalAssessment({ passingScore: assessment.passingScore, questions: assessment.questions }, answers);

    // Final assessment is the primary evidence for mastery.
    const masteryUpdates = grade.skillResults.map((skill) => {
      const before = this.store.getConceptMastery(studentId, skill.conceptCode, 0.42);
      const delta = (skill.scoreRatio - 0.5) * 0.4; // [-0.2, +0.2]
      const after = Math.max(0.02, Math.min(0.98, before + delta));
      this.store.setConceptMastery(studentId, skill.conceptCode, after);
      return { conceptCode: skill.conceptCode, before: Number(before.toFixed(4)), after: Number(after.toFixed(4)), scoreRatio: skill.scoreRatio, weak: skill.weak };
    });

    const knowledgeGaps = grade.skillResults.filter((skill) => skill.weak).map((skill) => skill.conceptCode);
    const recommendations = this.buildRecommendations(content, studentId, grade, knowledgeGaps);

    const existing = this.store.getSectionProgress(studentId, id, "FINAL_ASSESSMENT");
    const progress: SectionProgress = {
      studentId,
      contentId: id,
      sectionType: "FINAL_ASSESSMENT",
      status: grade.passed ? "COMPLETED" : "FAILED",
      progressPercent: 100,
      score: grade.scoreRatio,
      attempts: (existing?.attempts ?? 0) + 1,
      ...(grade.passed ? { completedAt: new Date().toISOString() } : {})
    };
    this.store.setSectionProgress(progress);

    const lessonComplete = this.isLessonComplete(content, studentId);
    return {
      contentId: id,
      passed: grade.passed,
      score: grade.scoreRatio,
      passingScore: grade.passingScore,
      earned: grade.earned,
      total: grade.total,
      questionResults: grade.questionResults,
      skillResults: masteryUpdates,
      knowledgeGaps,
      recommendations,
      lessonComplete,
      attempts: progress.attempts
    };
  }

  private buildRecommendations(
    content: DemoContent,
    studentId: string,
    grade: ReturnType<typeof gradeFinalAssessment>,
    knowledgeGaps: string[]
  ): Array<Record<string, unknown>> {
    const now = new Date().toISOString();
    const created: Array<Record<string, unknown>> = [];
    if (grade.passed && knowledgeGaps.length === 0) {
      const rec = { id: `rec-${randomUUID()}`, studentId, contentId: content.id, conceptCode: content.conceptCode, action: "CONTINUE" as const, reason: "Đã đạt bài kiểm tra cuối bài, có thể học bài tiếp theo.", createdAt: now };
      this.store.recommendations.set(rec.id, rec);
      return [rec];
    }
    for (const conceptCode of knowledgeGaps.length ? knowledgeGaps : [content.conceptCode]) {
      const reviewRec = { id: `rec-${randomUUID()}`, studentId, contentId: content.id, conceptCode, action: "REVIEW_THEORY" as const, reason: `Kỹ năng ${conceptCode} còn yếu — ôn lại phần Lý thuyết liên quan.`, createdAt: now };
      const practiceRec = { id: `rec-${randomUUID()}`, studentId, contentId: content.id, conceptCode, action: "MORE_PRACTICE" as const, reason: `Luyện thêm bài Thực hành cho ${conceptCode} trước khi làm lại kiểm tra.`, createdAt: now };
      this.store.recommendations.set(reviewRec.id, reviewRec);
      this.store.recommendations.set(practiceRec.id, practiceRec);
      created.push(reviewRec, practiceRec);
    }
    return created;
  }

  private completionGate(content: DemoContent, studentId: string): { theoryDone: boolean; practiceDone: boolean } {
    const theory = this.store.getSectionProgress(studentId, content.id, "THEORY");
    const practice = this.store.getSectionProgress(studentId, content.id, "PRACTICE");
    const practiceSection = content.sections.find((entry) => entry.type === "PRACTICE");
    const minActivities = practiceSection?.completionRule?.minActivitiesCompleted ?? 1;
    return {
      theoryDone: theory?.status === "COMPLETED",
      practiceDone: practice?.status === "COMPLETED" || (practice?.progressPercent ?? 0) >= 100 || minActivities === 0
    };
  }

  isLessonComplete(content: DemoContent, studentId: string): boolean {
    const gate = this.completionGate(content, studentId);
    const final = this.store.getSectionProgress(studentId, content.id, "FINAL_ASSESSMENT");
    return gate.theoryDone && gate.practiceDone && final?.status === "COMPLETED";
  }

  lessonProgress(id: string, studentId = "student-minh"): Record<string, unknown> {
    const content = this.getForTeacher(id);
    const sections = content.sections.map((section) => {
      const progress = this.store.getSectionProgress(studentId, id, section.type);
      return {
        type: section.type,
        title: section.title,
        order: section.order,
        status: progress?.status ?? "NOT_STARTED",
        progressPercent: progress?.progressPercent ?? 0,
        score: progress?.score
      };
    });
    return {
      contentId: id,
      sections,
      lessonComplete: this.isLessonComplete(content, studentId),
      recommendations: this.store.recommendationsForStudent(studentId).filter((rec) => rec.contentId === id)
    };
  }

  private transition(
    id: string,
    to: DemoContent["status"],
    action: string,
    comment: string | undefined,
    allowed: DemoContent["status"][]
  ): DemoContent {
    const content = this.getForTeacher(id);
    const from = content.status;
    if (!allowed.includes(from)) throw new BadRequestException(`Cannot ${action} content from ${from}`);
    content.status = to;
    content.version += 1;
    content.updatedAt = new Date().toISOString();
    content.reviewHistory.push({ action, from, to, at: content.updatedAt, ...(comment ? { comment } : {}) });
    this.store.contents.set(id, content);
    return content;
  }
}
