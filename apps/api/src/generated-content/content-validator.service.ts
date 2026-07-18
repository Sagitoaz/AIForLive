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
    if (output.sections.length !== 3 || output.sections.map((section) => section.phase).join(",") !== "THEORY,PRACTICE,CHECKPOINT") {
      throw new BadRequestException("Lesson draft must contain THEORY, PRACTICE and CHECKPOINT in order");
    }
    if (output.sections.some((section) => section.durationMinutes < 1 || !section.activityTypes.length)) {
      throw new BadRequestException("Each lesson phase needs a duration and at least one activity type");
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
    const raw = JSON.stringify(output).toLowerCase();
    const forbidden = ["<script", "javascript:", "<iframe", "http://", "https://", "onerror="];
    if (forbidden.some((token) => raw.includes(token))) {
      throw new BadRequestException("Raw HTML, scripts and remote URLs are forbidden");
    }
  }
}
