import { BadRequestException, Injectable } from "@nestjs/common";
import type { ProviderOutput } from "../ai-generation/providers/content-provider";

@Injectable()
export class ContentValidatorService {
  validate(output: ProviderOutput): void {
    if (output.slides.length < 3 || output.slides.length > 5) {
      throw new BadRequestException("Micro-lesson must have 3–5 slides");
    }
    if (!output.objectives.length || !output.sourceReferences.length) {
      throw new BadRequestException("Objective and source reference are required");
    }
    if (!output.slides.some((slide) => slide.type === "EXAMPLE")) {
      throw new BadRequestException("An example slide is required");
    }
    if (!output.slides.some((slide) => slide.type === "MISCONCEPTION")) {
      throw new BadRequestException("A misconception explanation is required");
    }
    if (output.quiz.correctIndex < 0 || output.quiz.correctIndex >= output.quiz.options.length) {
      throw new BadRequestException("Quiz must have exactly one valid answer index");
    }

    // FEATURE-016 — every generated lesson must contain all three parts.
    this.validateThreePart(output);

    const raw = JSON.stringify(output).toLowerCase();
    const forbidden = ["<script", "javascript:", "<iframe", "http://", "https://", "onerror="];
    if (forbidden.some((token) => raw.includes(token))) {
      throw new BadRequestException("Raw HTML, scripts and remote URLs are forbidden");
    }
  }

  private validateThreePart(output: ProviderOutput): void {
    // Theory must not be completely empty (slides already checked, but require summary too).
    if (!output.theory || !output.theory.summary?.trim()) {
      throw new BadRequestException("Theory section must include a summary");
    }
    // Practice must have at least one activity.
    if (!Array.isArray(output.practice) || output.practice.length === 0) {
      throw new BadRequestException("Practice section must contain at least one activity");
    }
    // Every graded activity needs an answer key (correctIndex or expectedOutput/solution).
    const gradedActivity = output.practice.find(
      (activity) => activity.maxScore > 0 &&
        typeof activity.correctIndex !== "number" &&
        !activity.expectedOutput &&
        !activity.solution
    );
    if (gradedActivity) {
      throw new BadRequestException(`Practice activity "${gradedActivity.title}" is missing an answer key`);
    }
    // Final assessment must have questions and a valid passing score.
    const assessment = output.finalAssessment;
    if (!assessment || !Array.isArray(assessment.questions) || assessment.questions.length === 0) {
      throw new BadRequestException("Final assessment must contain at least one question");
    }
    if (assessment.passingScore <= 0 || assessment.passingScore > 1) {
      throw new BadRequestException("Final assessment passing score must be between 0 and 1");
    }
    if (!assessment.skillCoverage?.length) {
      throw new BadRequestException("Final assessment must declare skill coverage");
    }
    // Every question needs an answer key so it can be graded.
    const unanswerable = assessment.questions.find(
      (question) =>
        !(question.options && typeof question.correctIndex === "number") &&
        !question.expectedAnswer?.trim()
    );
    if (unanswerable) {
      throw new BadRequestException(`Assessment question "${unanswerable.prompt}" has no answer key`);
    }
    // Assessment must cover the objectives it claims (at least one concept in coverage).
    if (!assessment.questions.every((question) => assessment.skillCoverage.includes(question.conceptCode))) {
      throw new BadRequestException("Assessment questions must map to declared skill coverage");
    }
  }
}
