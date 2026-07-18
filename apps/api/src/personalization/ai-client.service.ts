import { Injectable, Logger } from "@nestjs/common";
import type { AnalysisResult, LearningAttempt } from "../common/types";
import type { SubmitAttemptDto } from "../learning-events/dto/submit-attempt.dto";

export interface PersonalizationContext {
  stability: number;
  retrievability: number;
  prerequisiteMastery: number;
  courseProgress: number;
  availableMinutes: number;
  studentGoal: string;
}

function isAnalysis(value: unknown): value is AnalysisResult {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.mastery_after === "number" &&
    typeof record.forgetting_risk === "number" &&
    typeof record.diagnosis === "object" &&
    typeof record.recommendation === "object"
  );
}

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);

  async analyze(
    eventId: string,
    dto: SubmitAttemptDto,
    mastery: number,
    recentAttempts: LearningAttempt[],
    context: PersonalizationContext
  ): Promise<AnalysisResult> {
    const endpoint = `${process.env.AI_SERVICE_URL ?? "http://localhost:8001"}/v1/personalization/analyze-event`;
    const recent = recentAttempts.slice(-10);
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-correlation-id": eventId,
            "idempotency-key": dto.idempotencyKey
          },
          body: JSON.stringify({
            event_id: eventId,
            student_id: dto.studentId,
            domain_code: dto.domainCode,
            course_id: dto.courseId,
            concept_code: dto.conceptCode,
            current_state: {
              mastery,
              stability: context.stability,
              retrievability: context.retrievability,
              recent_failures: recent.filter((item) => !item.isCorrect).length,
              last_practiced_at: recent.at(-1)?.createdAt
            },
            attempt: {
              is_correct: dto.isCorrect,
              used_hint: dto.usedHint,
              attempt_number: dto.attemptNumber,
              difficulty: dto.difficulty,
              response_time_ms: dto.responseTimeMs,
              skipped: dto.skipped,
              submitted_answer: dto.submittedAnswer,
              expected_answer: dto.expectedAnswer,
              stop_value: dto.stopValue
            },
            recent_history: recent.map((item) => ({
              is_correct: item.isCorrect,
              used_hint: item.usedHint,
              occurred_at: item.createdAt,
              misconception_code: item.analysis?.diagnosis.misconception_code ?? null
            })),
            prerequisite_mastery: context.prerequisiteMastery,
            course_progress: context.courseProgress,
            available_minutes: context.availableMinutes,
            student_goal: context.studentGoal
          }),
          signal: AbortSignal.timeout(2_500)
        });
        if (!response.ok) throw new Error(`AI service returned ${response.status}`);
        const body: unknown = await response.json();
        if (!isAnalysis(body)) throw new Error("AI response failed contract validation");
        return { ...body, mode: "AI_SERVICE" };
      } catch (error) {
        lastError = error;
        this.logger.warn(JSON.stringify({ event: "ai_analysis_retry", eventId, attempt, error: String(error) }));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("AI analysis unavailable");
  }
}
