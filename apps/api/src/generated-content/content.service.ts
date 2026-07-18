import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { DemoContent } from "../common/types";
import type { GenerateContentDto } from "../ai-generation/dto/generate-content.dto";
import { ExternalLlmProvider } from "../ai-generation/providers/external-llm.provider";
import { LocalTemplateProvider } from "../ai-generation/providers/local-template.provider";
import { MockDevelopmentProvider } from "../ai-generation/providers/mock-development.provider";
import { DomainRegistryService } from "../domains/domain-registry.service";
import { DemoStoreService } from "../shared/demo-store.service";
import { ContentValidatorService } from "./content-validator.service";
import type { EditContentDto } from "./dto/review-content.dto";

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
    return content;
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
    const from = content.status;
    if (from === "DRAFT") content.status = "IN_REVIEW";
    return this.transition(id, "APPROVED", "APPROVE", comment, ["IN_REVIEW"]);
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
