import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { DemoAttempt } from "../common/types";
import { AiClientService } from "../personalization/ai-client.service";
import { FallbackAnalysisService } from "../personalization/fallback-analysis.service";
import { DemoStoreService } from "../shared/demo-store.service";
import type { LearningEventDto, SubmitAttemptDto } from "./dto/submit-attempt.dto";

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
    const duplicate = this.store.findAttemptByKey(dto.idempotencyKey);
    if (duplicate) return duplicate;

    const recentAttempts = this.store.attemptHistory(dto.studentId, dto.conceptCode);
    const eventId = randomUUID();
    const attempt: DemoAttempt = {
      id: eventId,
      idempotencyKey: dto.idempotencyKey,
      studentId: dto.studentId,
      conceptCode: dto.conceptCode,
      isCorrect: dto.isCorrect,
      usedHint: dto.usedHint,
      status: "PENDING_ANALYSIS",
      createdAt: new Date().toISOString(),
      analysis: null
    };
    this.store.attempts.set(eventId, attempt);
    const mastery = this.store.getConceptMastery(dto.studentId, dto.conceptCode, 0.4);
    try {
      attempt.analysis = await this.ai.analyze(eventId, dto, mastery, recentAttempts);
      attempt.status = "ANALYZED";
    } catch (error) {
      attempt.analysis = this.fallback.analyze(eventId, dto, mastery);
      attempt.status = "FALLBACK_ANALYZED";
      this.logger.warn(JSON.stringify({ event: "personalization_fallback", eventId, error: String(error) }));
    }
    this.store.setConceptMastery(dto.studentId, dto.conceptCode, attempt.analysis.mastery_after);
    this.store.attempts.set(eventId, attempt);
    return attempt;
  }

  analysis(attemptId: string): DemoAttempt {
    const attempt = this.store.attempts.get(attemptId);
    if (!attempt) throw new NotFoundException("Attempt not found");
    return attempt;
  }
}
