import type { DemoSlide } from "../../common/types";
import type { GenerateContentDto } from "../dto/generate-content.dto";

export interface ProviderOutput {
  title: string;
  objectives: string[];
  sourceReferences: string[];
  slides: DemoSlide[];
  quiz: { question: string; options: string[]; correctIndex: number; explanation: string };
  provider: "LOCAL_TEMPLATE" | "EXTERNAL_LLM";
  generationMs: number;
  estimatedCostUsd: number;
}

export interface ContentProvider {
  readonly code: string;
  generate(input: GenerateContentDto): Promise<ProviderOutput>;
}
