import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { DemoSlide } from "../../common/types";
import type { GenerateContentDto } from "../dto/generate-content.dto";
import type { ContentProvider, ProviderOutput } from "./content-provider";
import {
  buildFinalAssessmentMaterial,
  buildPracticeMaterial,
  buildTheoryMaterial,
  isAdvancedLevel
} from "./section-material";

const slideTypes = new Set<DemoSlide["type"]>([
  "CONCEPT",
  "CODE_STEP",
  "EXAMPLE",
  "MISCONCEPTION",
  "VISUAL",
  "QUIZ",
  "SUMMARY"
]);
const animationTemplates = new Set([
  "NUMBER_SEQUENCE",
  "VARIABLE_CHANGE",
  "CODE_HIGHLIGHT",
  "FLOW_BRANCH",
  "LOOP_TIMELINE",
  "LIST_INDEX",
  "FUNCTION_FLOW",
  "BUG_REVEAL"
]);

type JsonRecord = Record<string, unknown>;

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be a non-empty string array`);
  }
  return value.map((item) => (item as string).trim());
}

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(`${label} must be an integer`);
  return value;
}

function defaultAnimationTemplate(type: DemoSlide["type"], conceptCode: string): string {
  if (type === "MISCONCEPTION") return "BUG_REVEAL";
  if (type === "EXAMPLE" && ["PYTHON_FOR", "PYTHON_WHILE", "PYTHON_RANGE"].includes(conceptCode)) return "LOOP_TIMELINE";
  if (conceptCode === "PYTHON_RANGE") return "NUMBER_SEQUENCE";
  if (conceptCode === "PYTHON_VARIABLES") return "VARIABLE_CHANGE";
  if (conceptCode === "PYTHON_IF_ELSE") return "FLOW_BRANCH";
  if (conceptCode === "PYTHON_LISTS") return "LIST_INDEX";
  if (conceptCode === "PYTHON_FUNCTIONS") return "FUNCTION_FLOW";
  return "CODE_HIGHLIGHT";
}

function parseJsonContent(content: string): JsonRecord {
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error("Model response does not contain a JSON object");
  return record(JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)), "lesson");
}

function parseAnimationData(value: unknown, label: string): DemoSlide["animationData"] {
  const source = record(value, label);
  const result: DemoSlide["animationData"] = {};
  const assign = (key: string, item: unknown): void => {
    if (typeof item === "string" || typeof item === "number") {
      result[key] = item;
      return;
    }
    if (typeof item === "boolean") {
      result[key] = String(item);
      return;
    }
    if (Array.isArray(item) && item.every((entry) => ["string", "number", "boolean"].includes(typeof entry))) {
      result[key] = item.map(String);
      return;
    }
    throw new Error(`${label}.${key} has an unsupported value`);
  };
  for (const [key, item] of Object.entries(source)) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      for (const [nestedKey, nestedValue] of Object.entries(item as JsonRecord)) assign(nestedKey, nestedValue);
    } else {
      assign(key, item);
    }
  }
  return result;
}

function parseLesson(payload: JsonRecord, input: GenerateContentDto): Omit<ProviderOutput, "provider" | "generationMs" | "estimatedCostUsd"> {
  const rawSlides = payload.slides;
  if (!Array.isArray(rawSlides) || rawSlides.length < 3 || rawSlides.length > 5) {
    throw new Error("slides must contain 3 to 5 items");
  }
  const slides = rawSlides.map((rawSlide, index): DemoSlide => {
    const slide = record(rawSlide, `slides[${index}]`);
    const type = text(slide.type, `slides[${index}].type`);
    if (!slideTypes.has(type as DemoSlide["type"])) throw new Error(`slides[${index}].type is not allowed`);
    const animationTemplate = typeof slide.animationTemplate === "string" && slide.animationTemplate.trim()
      ? slide.animationTemplate.trim()
      : defaultAnimationTemplate(type as DemoSlide["type"], input.conceptCode);
    if (!animationTemplates.has(animationTemplate)) throw new Error(`slides[${index}].animationTemplate is not allowed`);
    const code = typeof slide.code === "string" && slide.code.trim()
      ? slide.code.trim()
      : undefined;
    return {
      id: `slide-${index + 1}`,
      order: index + 1,
      type: type as DemoSlide["type"],
      title: text(slide.title, `slides[${index}].title`),
      body: text(slide.body, `slides[${index}].body`),
      ...(code ? { code } : {}),
      narration: text(slide.narration, `slides[${index}].narration`),
      animationTemplate,
      animationData: parseAnimationData(slide.animationData ?? {}, `slides[${index}].animationData`)
    };
  });
  const quiz = record(payload.quiz, "quiz");
  const options = strings(quiz.options, "quiz.options");
  if (options.length < 2 || options.length > 5) throw new Error("quiz.options must contain 2 to 5 items");
  const correctIndex = integer(quiz.correctIndex, "quiz.correctIndex");
  if (correctIndex < 0 || correctIndex >= options.length) throw new Error("quiz.correctIndex is outside quiz.options");
  const objectives = strings(payload.objectives, "objectives");
  if (objectives.length > 4) throw new Error("objectives must contain at most 4 items");
  const parsedQuiz = {
    question: text(quiz.question, "quiz.question"),
    options,
    correctIndex,
    explanation: text(quiz.explanation, "quiz.explanation")
  };
  // FEATURE-016: the FPT model returns the THEORY slide deck + quiz. The
  // PRACTICE and FINAL_ASSESSMENT material is derived deterministically so the
  // three-part structure is always complete and passes the section validator.
  const isRange = input.misconceptionCode === "RANGE_STOP_INCLUDED";
  const advanced = isAdvancedLevel(input.level);
  return {
    title: text(payload.title, "title"),
    objectives,
    sourceReferences: [input.sourceId],
    slides,
    quiz: parsedQuiz,
    theory: buildTheoryMaterial(input, isRange, advanced),
    practice: buildPracticeMaterial(input, isRange, advanced, parsedQuiz),
    finalAssessment: buildFinalAssessmentMaterial(input, isRange, advanced)
  };
}

function estimateCost(response: ChatCompletionResponse): number {
  const inputRate = Number(process.env.EXTERNAL_LLM_INPUT_USD_PER_MILLION ?? 0);
  const outputRate = Number(process.env.EXTERNAL_LLM_OUTPUT_USD_PER_MILLION ?? 0);
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  return Number(((inputTokens * inputRate + outputTokens * outputRate) / 1_000_000).toFixed(6));
}

@Injectable()
export class ExternalLlmProvider implements ContentProvider {
  readonly code = "EXTERNAL_LLM";

  async generate(input: GenerateContentDto): Promise<ProviderOutput> {
    const apiKey = process.env.EXTERNAL_LLM_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException("External provider key is not configured; choose Local demo provider");
    }
    const baseUrl = (process.env.EXTERNAL_LLM_BASE_URL ?? "https://mkp-api.fptcloud.com").replace(/\/+$/, "");
    const model = process.env.EXTERNAL_LLM_MODEL ?? "DeepSeek-V4-Flash";
    const timeoutMs = Number(process.env.EXTERNAL_LLM_TIMEOUT_MS ?? 60_000);
    const startedAt = performance.now();
    const systemPrompt = [
      "Bạn là chuyên gia thiết kế bài học STEM cho học sinh K-12 Việt Nam.",
      "Chỉ trả về một JSON object, không Markdown, không HTML, không URL và không JavaScript thực thi.",
      "Ngôn ngữ phải tự nhiên, đơn giản, tích cực; mọi nội dung sẽ ở trạng thái DRAFT để giáo viên duyệt.",
      "JSON gồm title, objectives (1-4 mục), slides (3-5 mục) và quiz.",
      "Mỗi slide gồm id, order, type, title, body, code tùy chọn, narration, animationTemplate, animationData.",
      `type chỉ thuộc: ${[...slideTypes].join(", ")}.`,
      `animationTemplate chỉ thuộc: ${[...animationTemplates].join(", ")}.`,
      "animationData phải là object phẳng; value chỉ là string, number hoặc mảng string.",
      "Phải có ít nhất một slide EXAMPLE và một slide MISCONCEPTION.",
      "quiz gồm question, options (2-5 đáp án), correctIndex dạng số bắt đầu từ 0 và explanation.",
      "Không thêm sourceReferences; hệ thống sẽ gắn source ID đã kiểm chứng."
    ].join("\n");
    const userPrompt = JSON.stringify({
      task: "Tạo micro-lesson có cấu trúc",
      locale: "vi-VN",
      audience: `Học sinh K-12 Việt Nam, trình độ ${input.level}`,
      domainCode: input.domainCode,
      conceptCode: input.conceptCode,
      misconceptionCode: input.misconceptionCode,
      learningObjective: input.learningObjective,
      durationMinutes: input.durationMinutes,
      verifiedSourceId: input.sourceId
    });

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          thinking: { type: "disabled" },
          temperature: 0.2,
          max_tokens: 2_400,
          stream: false
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) {
        throw new Error(`FPT AI returned HTTP ${response.status}`);
      }
      const completion = (await response.json()) as ChatCompletionResponse;
      const content = completion.choices?.[0]?.message?.content;
      if (!content) throw new Error("FPT AI response does not contain message content");
      const lesson = parseLesson(parseJsonContent(content), input);
      return {
        ...lesson,
        provider: "EXTERNAL_LLM",
        generationMs: Math.max(1, Math.round(performance.now() - startedAt)),
        estimatedCostUsd: estimateCost(completion)
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider error";
      throw new ServiceUnavailableException(`FPT AI generation failed: ${message}`);
    }
  }
}
