import type { ContentSlide } from "../../common/types";
import type { GenerateContentDto } from "../dto/generate-content.dto";

export type LessonActivityType = "LECTURE" | "VIDEO" | "ANIMATION" | "DOCUMENT" | "CODE" | "MULTIPLE_CHOICE" | "CODE_ORDER" | "DEBUG" | "PROJECT";

export interface LessonDraftSection {
  phase: "THEORY" | "PRACTICE" | "CHECKPOINT";
  title: string;
  durationMinutes: number;
  summary: string;
  activityTypes: LessonActivityType[];
}

export interface ContentGenerationInput extends GenerateContentDto {
  sourceExcerpt?: string;
}

export interface ProviderOutput {
  title: string;
  objectives: string[];
  sourceReferences: string[];
  slides: ContentSlide[];
  quiz: { question: string; options: string[]; correctIndex: number; explanation: string };
  provider: "LOCAL_TEMPLATE" | "EXTERNAL_LLM";
  generationMs: number;
  estimatedCostUsd: number;
  trace?: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    promptHash: string;
  };
  sections: LessonDraftSection[];
}

export interface ContentProvider {
  readonly code: string;
  generate(input: ContentGenerationInput): Promise<ProviderOutput>;
}
