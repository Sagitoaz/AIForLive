import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ActivityType,
  LearningEventStatus,
  LessonPhase,
  Prisma,
  RecommendationAction,
  ReviewScheduleStatus
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { AnalysisResult, LearningAttempt } from "../common/types";
import { PrismaService } from "../database/prisma.service";
import { AiClientService } from "../personalization/ai-client.service";
import { FallbackAnalysisService } from "../personalization/fallback-analysis.service";
import { SubmitAttemptDto, type LearningEventDto } from "./dto/submit-attempt.dto";

function normalizeAnswer(value: string): string {
  return value.toLowerCase().normalize("NFC").replace(/\s+/g, "").replaceAll("[", "").replaceAll("]", "");
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiClientService,
    private readonly fallback: FallbackAnalysisService
  ) {}

  async recordEvent(dto: LearningEventDto): Promise<Record<string, unknown>> {
    const enrollment = await this.activeEnrollment(dto.studentId);
    const type = this.activityType(dto.type);
    const existing = await this.prisma.learningEvent.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
    if (existing) return this.eventDto(existing);
    const event = await this.prisma.learningEvent.create({
      data: {
        idempotencyKey: dto.idempotencyKey,
        userId: dto.studentId,
        courseId: enrollment.courseId,
        type,
        status: LearningEventStatus.ANALYZED,
        analyzedAt: new Date(),
        correlationId: randomUUID(),
        payloadJson: json(dto.metadata ?? {}),
        metadataJson: { source: "web" }
      }
    });
    return this.eventDto(event);
  }

  async submitAttempt(dto: SubmitAttemptDto): Promise<LearningAttempt> {
    const [exercise, enrollment] = await Promise.all([
      this.prisma.exercise.findFirst({
        where: {
          OR: [{ id: dto.activityId ?? "" }, { code: dto.activityId ?? "" }],
          status: "ACTIVE",
          deletedAt: null
        },
        include: {
          lesson: {
            include: {
              concept: true,
              module: { include: { course: { include: { domain: true } } } }
            }
          }
        }
      }),
      this.activeEnrollment(dto.studentId, dto.courseId)
    ]);
    if (!exercise) throw new NotFoundException("Bài tập không tồn tại trong Supabase");
    if (enrollment.courseId !== exercise.lesson.module.course.id) {
      throw new ForbiddenException("Bài tập không thuộc khóa học đang ghi danh");
    }
    const answerKey = this.answerKey(exercise.answerJson);
    const isCorrect = answerKey.acceptedAnswers.some(
      (answer) => normalizeAnswer(dto.submittedAnswer) === normalizeAnswer(answer)
    );
    const scoredDto = Object.assign(new SubmitAttemptDto(), dto, {
      courseId: enrollment.courseId,
      domainCode: exercise.lesson.module.course.domain.code,
      conceptCode: exercise.lesson.concept.code,
      activityId: exercise.id,
      lessonPhase: exercise.phase,
      difficulty: exercise.difficulty,
      expectedAnswer: answerKey.acceptedAnswers[0],
      stopValue: answerKey.stopValue,
      isCorrect
    });

    const stateRequest = this.prisma.studentConceptState.findUnique({
      where: {
        studentProfileId_conceptId: {
          studentProfileId: enrollment.studentProfileId,
          conceptId: exercise.lesson.concept.id
        }
      }
    });
    const recentRequest = this.prisma.attempt.findMany({
      where: { userId: dto.studentId, exercise: { concepts: { some: { conceptId: exercise.lesson.concept.id } } } },
      include: {
        exercise: { include: { lesson: { include: { concept: true } } } },
        event: { include: { personalizationRun: true } },
        diagnoses: true
      },
      orderBy: { createdAt: "desc" } as const,
      take: 10
    });
    const eventRequest = this.prisma.learningEvent.create({
      data: {
        idempotencyKey: scoredDto.idempotencyKey,
        userId: dto.studentId,
        courseId: enrollment.courseId,
        type: exercise.phase === LessonPhase.CHECKPOINT ? ActivityType.CHECKPOINT : ActivityType.EXERCISE,
        status: LearningEventStatus.PENDING_ANALYSIS,
        correlationId: randomUUID(),
        payloadJson: json({
          exerciseId: exercise.id,
          submittedAnswer: dto.submittedAnswer,
          lessonPhase: exercise.phase
        }),
        attempt: {
          create: {
            userId: dto.studentId,
            exerciseId: exercise.id,
            isCorrect,
            usedHint: dto.usedHint,
            skipped: dto.skipped,
            attemptNumber: dto.attemptNumber,
            responseTimeMs: dto.responseTimeMs,
            submittedJson: json({ answer: dto.submittedAnswer }),
            score: isCorrect ? 1 : 0,
            metadataJson: { scoring: "SERVER_ANSWER_KEY" }
          }
        }
      },
      include: { attempt: true }
    });

    let state: Awaited<typeof stateRequest>;
    let recentRows: Awaited<typeof recentRequest>;
    let event: Awaited<typeof eventRequest>;
    try {
      [state, recentRows, event] = await Promise.all([
        stateRequest,
        recentRequest,
        eventRequest
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await this.findByIdempotencyKey(dto.idempotencyKey);
        if (!duplicate) throw error;
        if (duplicate.studentId !== dto.studentId) throw new ForbiddenException("Idempotency key belongs to another user");
        return duplicate;
      }
      throw error;
    }
    const mastery = state?.mastery ?? 0.3;
    const recentAttempts = recentRows.reverse().map((row) => this.rowToAttempt(row));

    if (!event.attempt) throw new Error("Attempt transaction failed");

    const startedAt = Date.now();
    let analysis: AnalysisResult;
    let status: LearningEventStatus;
    try {
      analysis = await this.ai.analyze(event.id, scoredDto, mastery, recentAttempts);
      status = LearningEventStatus.ANALYZED;
    } catch (error) {
      analysis = this.fallback.analyze(event.id, scoredDto, mastery);
      status = LearningEventStatus.FALLBACK_ANALYZED;
      this.logger.warn(JSON.stringify({ event: "personalization_fallback", eventId: event.id, error: String(error) }));
    }

    await this.persistAnalysis({
      eventId: event.id,
      attemptId: event.attempt.id,
      studentProfileId: enrollment.studentProfileId,
      conceptId: exercise.lesson.concept.id,
      domainId: exercise.lesson.concept.domainId,
      analysis,
      status,
      durationMs: Date.now() - startedAt,
      previousStateVersion: state?.version ?? 0
    });
    return {
      id: event.attempt.id,
      idempotencyKey: scoredDto.idempotencyKey,
      studentId: dto.studentId,
      conceptCode: exercise.lesson.concept.code,
      activityId: exercise.id,
      lessonPhase: exercise.phase,
      isCorrect,
      usedHint: dto.usedHint,
      status,
      createdAt: event.createdAt.toISOString(),
      analysis
    };
  }

  async analysis(attemptId: string, userId: string): Promise<LearningAttempt> {
    const row = await this.prisma.attempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        exercise: { include: { lesson: { include: { concept: true } } } },
        event: { include: { personalizationRun: true } },
        diagnoses: true
      }
    });
    if (!row) throw new NotFoundException("Attempt not found");
    return this.rowToAttempt(row);
  }

  private async persistAnalysis(input: {
    eventId: string;
    attemptId: string;
    studentProfileId: string;
    conceptId: string;
    domainId: string;
    analysis: AnalysisResult;
    status: LearningEventStatus;
    durationMs: number;
    previousStateVersion: number;
  }): Promise<void> {
    const misconception = input.analysis.diagnosis.misconception_code
      ? await this.prisma.misconception.findFirst({
          where: { domainId: input.domainId, code: input.analysis.diagnosis.misconception_code }
        })
      : null;
    const recommendationId = randomUUID();
    await this.prisma.$transaction([
      this.prisma.recommendation.create({
        data: {
          id: recommendationId,
          studentProfileId: input.studentProfileId,
          conceptId: input.conceptId,
          action: this.recommendationAction(input.analysis.recommendation.action),
          priorityScore: input.analysis.recommendation.priority_score,
          targetType: input.analysis.recommendation.target?.type,
          targetId: input.analysis.recommendation.target?.id,
          targetPhase: input.analysis.recommendation.target?.phase,
          estimatedMinutes: input.analysis.recommendation.target?.estimated_minutes,
          reasonsJson: json(input.analysis.recommendation.reasons),
          candidateLogJson: json(input.analysis.recommendation.evidence),
          modelVersion: input.analysis.model_version,
          metadataJson: json({ explanations: input.analysis.explanations, mode: input.analysis.mode }),
          evidence: {
            create: {
              attemptId: input.attemptId,
              type: "ATTEMPT_ANALYSIS",
              valueJson: json(input.analysis.recommendation.evidence),
              explanation: input.analysis.explanations.join(" ").slice(0, 2_000)
            }
          }
        }
      }),
      this.prisma.attemptDiagnosis.create({
        data: {
          attemptId: input.attemptId,
          misconceptionId: misconception?.id,
          status: input.analysis.diagnosis.status,
          confidence: input.analysis.diagnosis.confidence,
          source: input.analysis.diagnosis.source,
          ruleCode: input.analysis.diagnosis.rule_id,
          evidenceJson: json(input.analysis.diagnosis.evidence),
          modelVersion: input.analysis.model_version
        }
      }),
      this.prisma.studentConceptState.upsert({
        where: {
          studentProfileId_conceptId: {
            studentProfileId: input.studentProfileId,
            conceptId: input.conceptId
          }
        },
        update: {
          mastery: input.analysis.mastery_after,
          stability: Math.max(0.2, input.analysis.recommended_interval_days),
          retrievability: input.analysis.retrievability,
          forgettingRisk: input.analysis.forgetting_risk,
          nextAttemptProbability: input.analysis.next_attempt_probability,
          modelVersion: input.analysis.model_version,
          version: { increment: 1 },
          lastPracticedAt: new Date()
        },
        create: {
          studentProfileId: input.studentProfileId,
          conceptId: input.conceptId,
          mastery: input.analysis.mastery_after,
          stability: Math.max(0.2, input.analysis.recommended_interval_days),
          retrievability: input.analysis.retrievability,
          forgettingRisk: input.analysis.forgetting_risk,
          nextAttemptProbability: input.analysis.next_attempt_probability,
          modelVersion: input.analysis.model_version,
          version: input.previousStateVersion + 1,
          lastPracticedAt: new Date()
        }
      }),
      this.prisma.conceptStateHistory.create({
        data: {
          studentProfileId: input.studentProfileId,
          conceptId: input.conceptId,
          mastery: input.analysis.mastery_after,
          stability: Math.max(0.2, input.analysis.recommended_interval_days),
          retrievability: input.analysis.retrievability,
          forgettingRisk: input.analysis.forgetting_risk,
          triggerEventId: input.eventId,
          modelVersion: input.analysis.model_version,
          metadataJson: json({ mode: input.analysis.mode })
        }
      }),
      this.prisma.reviewSchedule.create({
        data: {
          studentProfileId: input.studentProfileId,
          conceptId: input.conceptId,
          recommendationId,
          dueAt: new Date(Date.now() + input.analysis.recommended_interval_days * 86_400_000),
          intervalDays: input.analysis.recommended_interval_days,
          retrievabilityAtSchedule: input.analysis.retrievability,
          status: input.analysis.recommended_interval_days <= 0 ? ReviewScheduleStatus.DUE : ReviewScheduleStatus.SCHEDULED,
          metadataJson: json({ reason: input.analysis.recommendation.reasons[0] ?? "AI recommendation" })
        }
      }),
      this.prisma.personalizationRun.create({
        data: {
          learningEventId: input.eventId,
          studentProfileId: input.studentProfileId,
          mode: input.analysis.mode,
          inputJson: json({ masteryBefore: input.analysis.mastery_before }),
          outputJson: json(input.analysis),
          durationMs: input.durationMs,
          correlationId: input.eventId
        }
      }),
      this.prisma.learningEvent.update({
        where: { id: input.eventId },
        data: { status: input.status, analyzedAt: new Date() }
      })
    ]);
  }

  private async activeEnrollment(userId: string, courseId?: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        ...(courseId ? { courseId } : {}),
        student: { userId, status: "ACTIVE", deletedAt: null }
      },
      orderBy: { enrolledAt: "desc" }
    });
    if (!enrollment) throw new ForbiddenException("Học sinh chưa được ghi danh vào khóa học này");
    return enrollment;
  }

  private answerKey(value: Prisma.JsonValue): { acceptedAnswers: string[]; stopValue?: number } {
    if (!value || Array.isArray(value) || typeof value !== "object") {
      throw new BadRequestException("Bài tập chưa có đáp án đã được giáo viên duyệt");
    }
    const record = value as Record<string, unknown>;
    const acceptedAnswers = Array.isArray(record.acceptedAnswers)
      ? record.acceptedAnswers.filter((item): item is string => typeof item === "string")
      : typeof record.expectedAnswer === "string"
        ? [record.expectedAnswer]
        : [];
    if (!acceptedAnswers.length || record.teacherReviewed !== true) {
      throw new BadRequestException("Bài tập chưa có đáp án đã được giáo viên duyệt");
    }
    return { acceptedAnswers, ...(typeof record.stopValue === "number" ? { stopValue: record.stopValue } : {}) };
  }

  private activityType(value: string): ActivityType {
    return Object.values(ActivityType).includes(value as ActivityType) ? (value as ActivityType) : ActivityType.LESSON;
  }

  private recommendationAction(value: string): RecommendationAction {
    return Object.values(RecommendationAction).includes(value as RecommendationAction)
      ? (value as RecommendationAction)
      : RecommendationAction.CONTINUE_PATH;
  }

  private eventDto(event: { id: string; idempotencyKey: string; type: ActivityType; userId: string; status: LearningEventStatus; occurredAt: Date; metadataJson: Prisma.JsonValue }) {
    return {
      id: event.id,
      idempotencyKey: event.idempotencyKey,
      type: event.type,
      studentId: event.userId,
      metadata: event.metadataJson,
      status: event.status,
      occurredAt: event.occurredAt.toISOString()
    };
  }

  private async findByIdempotencyKey(key: string): Promise<LearningAttempt | null> {
    const row = await this.prisma.attempt.findFirst({
      where: { event: { idempotencyKey: key } },
      include: {
        exercise: { include: { lesson: { include: { concept: true } } } },
        event: { include: { personalizationRun: true } },
        diagnoses: true
      }
    });
    return row ? this.rowToAttempt(row) : null;
  }

  private rowToAttempt(row: {
    id: string;
    userId: string;
    isCorrect: boolean;
    usedHint: boolean;
    createdAt: Date;
    exercise: { id: string; phase: LessonPhase; lesson: { concept: { code: string } } };
    event: { idempotencyKey: string; status: LearningEventStatus; personalizationRun: { outputJson: Prisma.JsonValue } | null };
  }): LearningAttempt {
    return {
      id: row.id,
      idempotencyKey: row.event.idempotencyKey,
      studentId: row.userId,
      conceptCode: row.exercise.lesson.concept.code,
      activityId: row.exercise.id,
      lessonPhase: row.exercise.phase,
      isCorrect: row.isCorrect,
      usedHint: row.usedHint,
      status: row.event.status,
      createdAt: row.createdAt.toISOString(),
      analysis: row.event.personalizationRun?.outputJson as unknown as AnalysisResult | null
    };
  }
}
