import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { DemoAttempt } from "../common/types";
import { AiClientService } from "../personalization/ai-client.service";
import { FallbackAnalysisService } from "../personalization/fallback-analysis.service";
import { DemoStoreService } from "../shared/demo-store.service";
import type { LearningEventDto, SubmitAttemptDto } from "./dto/submit-attempt.dto";

const scoredActivities = {
  "practice-range-predict-01": { conceptCode: "PYTHON_RANGE", phase: "PRACTICE", difficulty: 0.45, expectedAnswer: "1, 2, 3, 4", stopValue: 5 },
  "checkpoint-range-01": { conceptCode: "PYTHON_RANGE", phase: "CHECKPOINT", difficulty: 0.65, expectedAnswer: "0,1,0", stopValue: 5 }
} as const;

function normalizeAnswer(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "").replace(/[[\]]/g, "");
}

@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    private readonly store: DemoStoreService,
    private readonly ai: AiClientService,
    private readonly fallback: FallbackAnalysisService
  ) {}

  recordEvent(dto: LearningEventDto): Record<string, unknown> {
    return {
      id: randomUUID(),
      idempotencyKey: dto.idempotencyKey,
      type: dto.type,
      studentId: dto.studentId,
      metadata: dto.metadata ?? {},
      status: "RECORDED",
      occurredAt: new Date().toISOString()
    };
  }

  async submitAttempt(dto: SubmitAttemptDto): Promise<DemoAttempt> {
    const scoredDto = this.scoreRegisteredActivity(dto);
    const duplicate = this.store.findAttemptByKey(scoredDto.idempotencyKey);
    if (duplicate) return duplicate;

    const recentAttempts = this.store.attemptHistory(scoredDto.studentId, scoredDto.conceptCode);
    const eventId = randomUUID();
    const attempt: DemoAttempt = {
      id: eventId,
      idempotencyKey: scoredDto.idempotencyKey,
      studentId: scoredDto.studentId,
      conceptCode: scoredDto.conceptCode,
      activityId: scoredDto.activityId,
      lessonPhase: scoredDto.lessonPhase,
      isCorrect: scoredDto.isCorrect,
      usedHint: scoredDto.usedHint,
      status: "PENDING_ANALYSIS",
      createdAt: new Date().toISOString(),
      analysis: null
    };
    this.store.attempts.set(eventId, attempt);
    const mastery = this.store.getConceptMastery(scoredDto.studentId, scoredDto.conceptCode, 0.4);
    try {
      attempt.analysis = await this.ai.analyze(eventId, scoredDto, mastery, recentAttempts);
      attempt.status = "ANALYZED";
    } catch (error) {
      attempt.analysis = this.fallback.analyze(eventId, scoredDto, mastery);
      attempt.status = "FALLBACK_ANALYZED";
      this.logger.warn(JSON.stringify({ event: "personalization_fallback", eventId, error: String(error) }));
    }
    this.store.setConceptMastery(scoredDto.studentId, scoredDto.conceptCode, attempt.analysis.mastery_after);
    this.store.attempts.set(eventId, attempt);
    return attempt;
  }

  private scoreRegisteredActivity(dto: SubmitAttemptDto): SubmitAttemptDto {
    if (!dto.activityId) return dto;
    const activity = scoredActivities[dto.activityId as keyof typeof scoredActivities];
    if (!activity) return dto;
    const submitted = normalizeAnswer(dto.submittedAnswer);
    const expected = normalizeAnswer(activity.expectedAnswer);
    let isCorrect = submitted === expected;
    if (dto.activityId === "checkpoint-range-01") {
      const submittedOptions = submitted.split(",");
      const expectedOptions = expected.split(",");
      isCorrect = expectedOptions.filter((answer, index) => submittedOptions[index] === answer).length >= 2;
    }
    return Object.assign(dto, {
      conceptCode: activity.conceptCode,
      lessonPhase: activity.phase,
      difficulty: activity.difficulty,
      expectedAnswer: activity.expectedAnswer,
      stopValue: activity.stopValue,
      isCorrect
    });
  }

  analysis(attemptId: string): DemoAttempt {
    const attempt = this.store.attempts.get(attemptId);
    if (!attempt) throw new NotFoundException("Attempt not found");
    return attempt;
  }
}
