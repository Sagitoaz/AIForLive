import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  AttemptCriterionResult,
  AttemptGradingDetails,
  AttemptGradingStrategy
} from "../common/types";
import type { AttemptSubmissionDto } from "./dto/submit-attempt.dto";

type JsonRecord = Record<string, unknown>;

interface RubricCriterion {
  id: string;
  description: string;
  weight: number;
  aliases: string[];
  required: boolean;
}

interface IdeaRubric {
  version: string;
  passThreshold: number;
  criteria: RubricCriterion[];
}

interface GradeExerciseInput {
  prompt: string;
  contentJson: Prisma.JsonValue;
  answerJson: Prisma.JsonValue;
  submission: AttemptSubmissionDto;
}

export interface ExerciseGrade {
  isCorrect: boolean;
  score: number;
  grading: AttemptGradingDetails;
  submittedAnswer: string;
  expectedAnswer: string;
  stopValue?: number;
}

interface IdeaEvaluation {
  mode: "EXTERNAL_LLM" | "DETERMINISTIC_RUBRIC_FALLBACK";
  model: string;
  promptVersion: string;
  rubricVersion: string;
  criteria: AttemptCriterionResult[];
  confidence: number;
  trace: NonNullable<AttemptGradingDetails["trace"]>;
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function nonEmptyText(value: unknown, label: string, maxLength = 2_000): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`${label} must be a non-empty string no longer than ${maxLength}`);
  }
  return value.trim();
}

function finiteNumber(value: unknown, label: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function stringArray(value: unknown, label: string, maximum = 100): string[] {
  if (!Array.isArray(value) || !value.length || value.length > maximum || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be a non-empty string array`);
  }
  return value.map((item) => (item as string).trim());
}

function normalizeExact(value: string): string {
  return value.toLowerCase().normalize("NFC").replace(/\s+/g, "").replaceAll("[", "").replaceAll("]", "");
}

function normalizeIdea(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function groundedEvidence(submission: string, evidence: string): boolean {
  const normalizedSubmission = submission.toLowerCase().normalize("NFC").replace(/\s+/g, " ").trim();
  const normalizedEvidence = evidence.toLowerCase().normalize("NFC").replace(/\s+/g, " ").trim();
  return Boolean(normalizedEvidence) && normalizedSubmission.includes(normalizedEvidence);
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

@Injectable()
export class ExerciseGraderService {
  async grade(input: GradeExerciseInput): Promise<ExerciseGrade> {
    const answerKey = this.answerKey(input.answerJson);
    const strategy = this.strategy(answerKey.strategy);
    if (strategy === "CODE_ORDER") return this.gradeCodeOrder(input, answerKey);
    if (strategy === "IDEA_RUBRIC") return this.gradeIdea(input, answerKey);
    return this.gradeLegacy(input, answerKey);
  }

  private gradeLegacy(input: GradeExerciseInput, answerKey: JsonRecord): ExerciseGrade {
    if (input.submission.kind === "CODE_ORDER" || typeof input.submission.text !== "string") {
      throw new BadRequestException("Bài tập này yêu cầu câu trả lời dạng văn bản");
    }
    const acceptedAnswers = Array.isArray(answerKey.acceptedAnswers)
      ? answerKey.acceptedAnswers.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      : typeof answerKey.expectedAnswer === "string" && answerKey.expectedAnswer.trim()
        ? [answerKey.expectedAnswer]
        : [];
    if (!acceptedAnswers.length) throw new BadRequestException("Bài tập chưa có đáp án đã được giáo viên duyệt");
    const submittedAnswer = input.submission.text;
    const isCorrect = acceptedAnswers.some((answer) => normalizeExact(answer) === normalizeExact(submittedAnswer));
    const score = isCorrect ? 1 : 0;
    return {
      isCorrect,
      score,
      submittedAnswer,
      expectedAnswer: acceptedAnswers[0]!,
      ...(typeof answerKey.stopValue === "number" ? { stopValue: answerKey.stopValue } : {}),
      grading: {
        strategy: "LEGACY_EXACT",
        mode: "SERVER_ANSWER_KEY",
        score,
        passThreshold: 1,
        confidence: 1,
        rubricVersion: null,
        criteria: [],
        feedback: isCorrect ? "Đáp án khớp answer key đã được giáo viên duyệt." : "Đáp án chưa khớp answer key đã được giáo viên duyệt."
      }
    };
  }

  private gradeCodeOrder(input: GradeExerciseInput, answerKey: JsonRecord): ExerciseGrade {
    if (input.submission.kind !== "CODE_ORDER" || !Array.isArray(input.submission.blockIds)) {
      throw new BadRequestException("Bài tập này yêu cầu danh sách blockIds theo thứ tự");
    }
    const content = record(input.contentJson, "contentJson");
    if (!Array.isArray(content.blocks) || !content.blocks.length) {
      throw new BadRequestException("Bài ghép code chưa có danh sách block hợp lệ");
    }
    const blocks = content.blocks.map((item, index) => {
      const block = record(item, `contentJson.blocks[${index}]`);
      return {
        id: nonEmptyText(block.id, `contentJson.blocks[${index}].id`, 160),
        text: nonEmptyText(block.text, `contentJson.blocks[${index}].text`)
      };
    });
    const publicIds = blocks.map((block) => block.id);
    if (new Set(publicIds).size !== publicIds.length) {
      throw new BadRequestException("Bài ghép code có block ID trùng lặp");
    }
    const submittedIds = input.submission.blockIds;
    if (new Set(submittedIds).size !== submittedIds.length) {
      throw new BadRequestException("Không được dùng một block nhiều lần");
    }
    if (submittedIds.length !== publicIds.length) {
      throw new BadRequestException("Phải dùng đủ tất cả block code đúng một lần");
    }
    const publicSet = new Set(publicIds);
    if (submittedIds.some((id) => !publicSet.has(id))) {
      throw new BadRequestException("Danh sách chứa block ID không thuộc bài tập");
    }
    const acceptedRaw = answerKey.acceptedBlockOrders;
    if (!Array.isArray(acceptedRaw) || !acceptedRaw.length) {
      throw new BadRequestException("Bài ghép code chưa có thứ tự đáp án đã được giáo viên duyệt");
    }
    const acceptedOrders = acceptedRaw.map((order, index) => {
      const ids = stringArray(order, `acceptedBlockOrders[${index}]`);
      if (ids.length !== publicIds.length || new Set(ids).size !== ids.length || ids.some((id) => !publicSet.has(id))) {
        throw new BadRequestException("Thứ tự đáp án đã duyệt không khớp danh sách block công khai");
      }
      return ids;
    });
    const serialized = submittedIds.join("\u001f");
    const isCorrect = acceptedOrders.some((order) => order.join("\u001f") === serialized);
    const blockText = new Map(blocks.map((block) => [block.id, block.text]));
    const submittedAnswer = submittedIds.map((id) => blockText.get(id)!).join("\n");
    const expectedAnswer = acceptedOrders[0]!.map((id) => blockText.get(id)!).join("\n");
    const score = isCorrect ? 1 : 0;
    return {
      isCorrect,
      score,
      submittedAnswer,
      expectedAnswer,
      grading: {
        strategy: "CODE_ORDER",
        mode: "DETERMINISTIC_CODE_ORDER",
        score,
        passThreshold: 1,
        confidence: 1,
        rubricVersion: typeof answerKey.rubricVersion === "string" ? answerKey.rubricVersion : null,
        criteria: [],
        feedback: isCorrect ? "Các khối code đã được ghép theo một thứ tự hợp lệ." : "Thứ tự khối code chưa tạo thành luồng giải đúng."
      }
    };
  }

  private async gradeIdea(input: GradeExerciseInput, answerKey: JsonRecord): Promise<ExerciseGrade> {
    if (input.submission.kind === "CODE_ORDER" || typeof input.submission.text !== "string" || !input.submission.text.trim()) {
      throw new BadRequestException("Bài tập này yêu cầu ý tưởng hoặc mã giả dạng văn bản");
    }
    const rubric = this.ideaRubric(answerKey);
    let evaluation: IdeaEvaluation;
    try {
      evaluation = await this.externalIdeaEvaluation(input.prompt, input.submission.text, rubric);
    } catch (error) {
      evaluation = this.deterministicIdeaEvaluation(input.submission.text, rubric, error);
    }
    const score = this.weightedScore(evaluation.criteria, rubric.criteria);
    const requiredPassed = rubric.criteria
      .filter((criterion) => criterion.required)
      .every((criterion) => (evaluation.criteria.find((item) => item.id === criterion.id)?.coverage ?? 0) >= 0.5);
    const isCorrect = score >= rubric.passThreshold && requiredPassed;
    const missing = evaluation.criteria
      .filter((criterion) => criterion.coverage < 0.5)
      .map((criterion) => rubric.criteria.find((reviewed) => reviewed.id === criterion.id)?.description ?? criterion.id);
    const feedback = missing.length
      ? `Ý tưởng đã đạt ${Math.round(score * 100)}%. Cần làm rõ: ${missing.join(", ")}.`
      : `Ý tưởng đã thể hiện đủ các bước cốt lõi (${Math.round(score * 100)}%).`;
    const expectedAnswer = rubric.criteria.map((criterion) => criterion.description).join("; ").slice(0, 2_000);
    return {
      isCorrect,
      score,
      submittedAnswer: input.submission.text,
      expectedAnswer,
      grading: {
        strategy: "IDEA_RUBRIC",
        mode: evaluation.mode,
        score,
        passThreshold: rubric.passThreshold,
        confidence: evaluation.confidence,
        rubricVersion: rubric.version,
        criteria: evaluation.criteria,
        feedback,
        trace: evaluation.trace
      }
    };
  }

  private async externalIdeaEvaluation(prompt: string, submission: string, rubric: IdeaRubric): Promise<IdeaEvaluation> {
    const endpoint = `${process.env.AI_SERVICE_URL ?? "http://localhost:8001"}/v1/grading/evaluate-idea`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt,
        submission,
        rubric: {
          version: rubric.version,
          criteria: rubric.criteria.map(({ id, description, weight, aliases, required }) => ({
            id,
            description,
            weight,
            aliases,
            required
          }))
        }
      }),
      signal: AbortSignal.timeout(Number(process.env.IDEA_GRADING_TIMEOUT_MS ?? 12_000))
    });
    if (!response.ok) throw new Error(`Idea grading service returned HTTP ${response.status}`);
    const payload = record(await response.json(), "grading response");
    if (payload.mode !== "EXTERNAL_LLM") throw new Error("Grading service did not prove an external model call");
    const rubricVersion = nonEmptyText(payload.rubric_version, "rubric_version", 160);
    if (rubricVersion !== rubric.version) throw new Error("Grading response rubric version mismatch");
    const rawCriteria = payload.criteria;
    if (!Array.isArray(rawCriteria) || rawCriteria.length !== rubric.criteria.length) {
      throw new Error("Grading response must contain every reviewed rubric criterion exactly once");
    }
    const expectedIds = new Set(rubric.criteria.map((criterion) => criterion.id));
    const criteria = rawCriteria.map((item, index): AttemptCriterionResult => {
      const criterion = record(item, `criteria[${index}]`);
      const id = nonEmptyText(criterion.criterion_id, `criteria[${index}].criterion_id`, 120);
      if (!expectedIds.has(id)) throw new Error(`Untrusted criterion ID: ${id}`);
      const coverage = finiteNumber(criterion.coverage, `criteria[${index}].coverage`, 0, 1);
      const evidence = Array.isArray(criterion.evidence)
        ? criterion.evidence.map((value, evidenceIndex) => nonEmptyText(value, `criteria[${index}].evidence[${evidenceIndex}]`, 300))
        : [];
      if (coverage > 0 && (!evidence.length || evidence.some((value) => !groundedEvidence(submission, value)))) {
        throw new Error(`Criterion ${id} contains evidence not grounded in the learner submission`);
      }
      return {
        id,
        coverage: round(coverage),
        evidence,
        feedback: nonEmptyText(criterion.feedback, `criteria[${index}].feedback`, 500)
      };
    });
    if (new Set(criteria.map((criterion) => criterion.id)).size !== criteria.length) {
      throw new Error("Grading response contains duplicate criterion IDs");
    }
    const trace = record(payload.trace, "trace");
    return {
      mode: "EXTERNAL_LLM",
      model: nonEmptyText(payload.model, "model", 160),
      promptVersion: nonEmptyText(payload.prompt_version, "prompt_version", 160),
      rubricVersion,
      criteria,
      confidence: round(finiteNumber(payload.confidence, "confidence", 0, 1)),
      trace: {
        provider: typeof trace.provider === "string" ? trace.provider : "EXTERNAL_LLM",
        model: nonEmptyText(payload.model, "model", 160),
        promptVersion: nonEmptyText(payload.prompt_version, "prompt_version", 160),
        promptHash: nonEmptyText(trace.prompt_hash, "trace.prompt_hash", 128),
        promptTokens: finiteNumber(trace.prompt_tokens, "trace.prompt_tokens", 0, 10_000_000),
        completionTokens: finiteNumber(trace.completion_tokens, "trace.completion_tokens", 0, 10_000_000),
        estimatedCostUsd: finiteNumber(trace.estimated_cost_usd, "trace.estimated_cost_usd", 0, 1_000_000),
        latencyMs: finiteNumber(trace.latency_ms, "trace.latency_ms", 0, 3_600_000)
      }
    };
  }

  private deterministicIdeaEvaluation(submission: string, rubric: IdeaRubric, error: unknown): IdeaEvaluation {
    const normalizedSubmission = normalizeIdea(submission);
    const criteria = rubric.criteria.map((criterion): AttemptCriterionResult => {
      const matchedAlias = criterion.aliases.find((alias) => normalizedSubmission.includes(normalizeIdea(alias)));
      const coverage = matchedAlias ? 1 : 0;
      return {
        id: criterion.id,
        coverage,
        evidence: [],
        feedback: matchedAlias
          ? `Đã nhận diện ý tưởng: ${criterion.description}`
          : `Cần bổ sung ý tưởng: ${criterion.description}`
      };
    });
    const fallbackReason = (error instanceof Error ? error.message : "External idea grader unavailable").slice(0, 300);
    return {
      mode: "DETERMINISTIC_RUBRIC_FALLBACK",
      model: "deterministic-rubric-v1",
      promptVersion: "deterministic-rubric-v1",
      rubricVersion: rubric.version,
      criteria,
      confidence: 0.68,
      trace: {
        provider: "LOCAL_RULES",
        model: "deterministic-rubric-v1",
        promptVersion: "deterministic-rubric-v1",
        promptHash: "not-applicable",
        promptTokens: 0,
        completionTokens: 0,
        estimatedCostUsd: 0,
        latencyMs: 0,
        fallbackReason
      }
    };
  }

  private weightedScore(results: AttemptCriterionResult[], criteria: RubricCriterion[]): number {
    const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    const score = criteria.reduce((sum, criterion) => {
      const coverage = results.find((result) => result.id === criterion.id)?.coverage ?? 0;
      return sum + coverage * criterion.weight;
    }, 0) / totalWeight;
    return round(score);
  }

  private ideaRubric(answerKey: JsonRecord): IdeaRubric {
    const version = nonEmptyText(answerKey.rubricVersion, "rubricVersion", 160);
    const passThreshold = answerKey.passThreshold === undefined
      ? 0.7
      : finiteNumber(answerKey.passThreshold, "passThreshold", 0, 1);
    if (!Array.isArray(answerKey.criteria) || !answerKey.criteria.length || answerKey.criteria.length > 12) {
      throw new BadRequestException("IDEA_RUBRIC cần từ 1 đến 12 tiêu chí đã được giáo viên duyệt");
    }
    const criteria = answerKey.criteria.map((item, index): RubricCriterion => {
      const criterion = record(item, `criteria[${index}]`);
      const aliases = stringArray(criterion.aliases, `criteria[${index}].aliases`, 30);
      if (aliases.some((alias) => !normalizeIdea(alias))) {
        throw new BadRequestException("IDEA_RUBRIC có alias không chứa tín hiệu chữ hoặc số");
      }
      return {
        id: nonEmptyText(criterion.id, `criteria[${index}].id`, 120),
        description: nonEmptyText(criterion.description, `criteria[${index}].description`, 500),
        weight: finiteNumber(criterion.weight, `criteria[${index}].weight`, Number.EPSILON, 100),
        aliases,
        required: criterion.required === true
      };
    });
    if (new Set(criteria.map((criterion) => criterion.id)).size !== criteria.length) {
      throw new BadRequestException("IDEA_RUBRIC có criterion ID trùng lặp");
    }
    return { version, passThreshold, criteria };
  }

  private answerKey(value: Prisma.JsonValue): JsonRecord {
    let answerKey: JsonRecord;
    try {
      answerKey = record(value, "answerJson");
    } catch {
      throw new BadRequestException("Bài tập chưa có đáp án đã được giáo viên duyệt");
    }
    if (answerKey.teacherReviewed !== true) {
      throw new BadRequestException("Bài tập chưa có đáp án đã được giáo viên duyệt");
    }
    return answerKey;
  }

  private strategy(value: unknown): AttemptGradingStrategy {
    if (value === undefined || value === null || value === "LEGACY_EXACT") return "LEGACY_EXACT";
    if (value === "IDEA_RUBRIC" || value === "CODE_ORDER") return value;
    throw new BadRequestException("Chiến lược chấm bài không được hỗ trợ");
  }
}
