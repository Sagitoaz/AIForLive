import type { AssessmentQuestion, DemoSlide, PracticeActivity } from "../../common/types";
import type { GenerateContentDto } from "../dto/generate-content.dto";

export interface ProviderOutput {
  title: string;
  objectives: string[];
  sourceReferences: string[];
  slides: DemoSlide[];
  quiz: { question: string; options: string[]; correctIndex: number; explanation: string };
  /**
   * FEATURE-016: providers must return the raw material for the three-part
   * structure. `theory` extras enrich the slide-based THEORY section,
   * `practice` powers the PRACTICE section and `finalAssessment` powers the
   * mandatory FINAL_ASSESSMENT section. A `lesson-sections` builder assembles
   * these into ordered `LessonSection`s.
   */
  theory: {
    videos: Array<{ title: string; description?: string; url: string; durationSeconds?: number; thumbnailUrl?: string }>;
    documents: Array<{ title: string; description?: string; content?: string; url?: string }>;
    summary: string;
  };
  practice: PracticeActivity[];
  finalAssessment: {
    passingScore: number;
    questions: AssessmentQuestion[];
    skillCoverage: string[];
  };
  provider: "LOCAL_TEMPLATE" | "EXTERNAL_LLM";
  generationMs: number;
  estimatedCostUsd: number;
}

export interface ContentProvider {
  readonly code: string;
  generate(input: GenerateContentDto): Promise<ProviderOutput>;
}
