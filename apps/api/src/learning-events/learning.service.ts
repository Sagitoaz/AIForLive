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

type RecommendationTarget = NonNullable<AnalysisResult["recommendation"]["target"]>;

interface RecommendationTargetContext {
  courseId: string;
  conceptId: string;
  currentLesson: {
    id: string;
    title: string;
    durationMinutes: number;
  };
  currentExercise: {
    id: string;
    prompt: string;
    phase: LessonPhase;
    difficulty: number;
  };
}

interface RecommendationTargetResolution {
  target: RecommendationTarget;
  metadata: {
    source: "PUBLISHED_MICRO_LESSON" | "ACTIVE_EXERCISE" | "ACTIVE_LESSON" | "CURRENT_EXERCISE" | "CURRENT_LESSON";
    entityType: "MicroLesson" | "Exercise" | "Lesson";
    entityId: string;
    originalSemanticTargetId: string | null;
  };
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
          deletedAt: null,
          lesson: {
            status: "ACTIVE",
            deletedAt: null,
            module: {
              status: "ACTIVE",
              deletedAt: null,
              course: { status: "ACTIVE", deletedAt: null }
            }
          }
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
    const prerequisiteRequest = this.prisma.conceptPrerequisite.findMany({
      where: { targetConceptId: exercise.lesson.concept.id },
      select: {
        prerequisite: {
          select: {
            studentStates: {
              where: { studentProfileId: enrollment.studentProfileId },
              select: { mastery: true },
              take: 1
            }
          }
        }
      }
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
    let prerequisiteRows: Awaited<typeof prerequisiteRequest>;
    let event: Awaited<typeof eventRequest>;
    try {
      [state, recentRows, prerequisiteRows, event] = await Promise.all([
        stateRequest,
        recentRequest,
        prerequisiteRequest,
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
    const prerequisiteValues = prerequisiteRows
      .map((row) => row.prerequisite.studentStates[0]?.mastery)
      .filter((value): value is number => typeof value === "number");
    const prerequisiteMastery = prerequisiteValues.length
      ? prerequisiteValues.reduce((total, value) => total + value, 0) / prerequisiteValues.length
      : mastery;
    scoredDto.prerequisiteMastery = prerequisiteMastery;
    const recentAttempts = recentRows.reverse().map((row) => this.rowToAttempt(row));

    if (!event.attempt) throw new Error("Attempt transaction failed");

    const startedAt = Date.now();
    let analysis: AnalysisResult;
    let status: LearningEventStatus;
    const personalizationContext = {
      stability: state?.stability ?? Math.max(0.5, 1 + mastery * 3),
      retrievability: state?.retrievability ?? Math.max(0.1, mastery),
      prerequisiteMastery,
      courseProgress: Math.max(0, Math.min(1, enrollment.progress)),
      availableMinutes: Math.max(5, Math.min(60, Math.round(enrollment.student.weeklyAvailabilityMinutes / 4))),
      studentGoal: enrollment.student.learningGoal ?? "Hoàn thành khóa học Python cơ bản"
    };
    try {
      analysis = await this.ai.analyze(event.id, scoredDto, mastery, recentAttempts, personalizationContext);
      status = LearningEventStatus.ANALYZED;
    } catch (error) {
      analysis = this.fallback.analyze(event.id, scoredDto, mastery);
      status = LearningEventStatus.FALLBACK_ANALYZED;
      this.logger.warn(JSON.stringify({ event: "personalization_fallback", eventId: event.id, error: String(error) }));
    }

    const targetResolution = await this.resolveRecommendationTarget(analysis, {
      courseId: enrollment.courseId,
      conceptId: exercise.lesson.concept.id,
      currentLesson: {
        id: exercise.lesson.id,
        title: exercise.lesson.title,
        durationMinutes: exercise.lesson.durationMinutes
      },
      currentExercise: {
        id: exercise.id,
        prompt: exercise.prompt,
        phase: exercise.phase,
        difficulty: exercise.difficulty
      }
    });
    analysis = {
      ...analysis,
      recommendation: {
        ...analysis.recommendation,
        target: targetResolution.target
      }
    };

    await this.persistAnalysis({
      eventId: event.id,
      attemptId: event.attempt.id,
      studentProfileId: enrollment.studentProfileId,
      conceptId: exercise.lesson.concept.id,
      domainId: exercise.lesson.concept.domainId,
      analysis,
      status,
      durationMs: Date.now() - startedAt,
      previousStateVersion: state?.version ?? 0,
      targetResolution: targetResolution.metadata,
      analysisInput: {
        masteryBefore: mastery,
        ...personalizationContext,
        responseTimeMs: scoredDto.responseTimeMs,
        usedHint: scoredDto.usedHint,
        skipped: scoredDto.skipped,
        attemptNumber: scoredDto.attemptNumber,
        difficulty: scoredDto.difficulty,
        recentAttemptIds: recentAttempts.map((attempt) => attempt.id)
      }
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
    targetResolution: RecommendationTargetResolution["metadata"];
    analysisInput: Record<string, unknown>;
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
          metadataJson: json({
            explanations: input.analysis.explanations,
            mode: input.analysis.mode,
            targetResolution: input.targetResolution
          }),
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
          inputJson: json(input.analysisInput),
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

  private async resolveRecommendationTarget(
    analysis: AnalysisResult,
    context: RecommendationTargetContext
  ): Promise<RecommendationTargetResolution> {
    const original = analysis.recommendation.target;
    const action = this.recommendationAction(analysis.recommendation.action);
    const originalSemanticTargetId = original?.id ?? null;

    if (action === RecommendationAction.MICRO_LESSON || original?.type === "MICRO_LESSON") {
      const microLesson = await this.prisma.microLesson.findFirst({
        where: {
          conceptId: context.conceptId,
          status: "PUBLISHED",
          ...(analysis.diagnosis.misconception_code
            ? {
                misconception: {
                  code: analysis.diagnosis.misconception_code,
                  status: "ACTIVE",
                  deletedAt: null
                }
              }
            : {}),
          generatedContent: {
            status: "PUBLISHED",
            generationJob: { courseId: context.courseId }
          }
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, durationMinutes: true }
      });
      if (microLesson) {
        return {
          target: {
            type: "MICRO_LESSON",
            id: microLesson.id,
            title: microLesson.title,
            phase: "THEORY",
            estimated_minutes: this.targetMinutes(microLesson.durationMinutes, original?.estimated_minutes),
            ...(original?.difficulty === undefined ? {} : { difficulty: original.difficulty })
          },
          metadata: {
            source: "PUBLISHED_MICRO_LESSON",
            entityType: "MicroLesson",
            entityId: microLesson.id,
            originalSemanticTargetId
          }
        };
      }
      return this.currentLessonTarget(context, originalSemanticTargetId, original?.estimated_minutes);
    }

    if (action === RecommendationAction.PREREQUISITE_REVIEW) {
      const prerequisiteLesson = await this.prisma.lesson.findFirst({
        where: {
          status: "ACTIVE",
          deletedAt: null,
          module: {
            courseId: context.courseId,
            status: "ACTIVE",
            deletedAt: null
          },
          concept: {
            status: "ACTIVE",
            deletedAt: null,
            prerequisiteFor: { some: { targetConceptId: context.conceptId } }
          }
        },
        orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
        select: { id: true, title: true, durationMinutes: true }
      });
      if (prerequisiteLesson) {
        return this.lessonTarget(prerequisiteLesson, "THEORY", originalSemanticTargetId, original?.estimated_minutes);
      }
      return this.currentLessonTarget(context, originalSemanticTargetId, original?.estimated_minutes);
    }

    if (action === RecommendationAction.CONTINUE_PATH || original?.type === "LESSON_PHASE") {
      const lessons = await this.prisma.lesson.findMany({
        where: {
          status: "ACTIVE",
          deletedAt: null,
          module: {
            courseId: context.courseId,
            status: "ACTIVE",
            deletedAt: null
          }
        },
        orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
        select: { id: true, title: true, durationMinutes: true }
      });
      const currentIndex = lessons.findIndex((lesson) => lesson.id === context.currentLesson.id);
      const selected = currentIndex >= 0 ? lessons[currentIndex + 1] : undefined;
      if (selected) {
        return this.lessonTarget(selected, original?.phase ?? "THEORY", originalSemanticTargetId, original?.estimated_minutes);
      }
      return this.currentLessonTarget(context, originalSemanticTargetId, original?.estimated_minutes);
    }

    const phase = action === RecommendationAction.CHECKPOINT
      ? LessonPhase.CHECKPOINT
      : action === RecommendationAction.TEACHER_SUPPORT
        ? null
        : LessonPhase.PRACTICE;
    if (phase) {
      const exercises = await this.prisma.exercise.findMany({
        where: {
          phase,
          status: "ACTIVE",
          deletedAt: null,
          lesson: {
            conceptId: context.conceptId,
            status: "ACTIVE",
            deletedAt: null,
            module: {
              courseId: context.courseId,
              status: "ACTIVE",
              deletedAt: null
            }
          }
        },
        orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }],
        take: 2,
        select: {
          id: true,
          prompt: true,
          phase: true,
          difficulty: true,
          lesson: { select: { durationMinutes: true } }
        }
      });
      const exercise = exercises.find((candidate) => candidate.id !== context.currentExercise.id) ?? exercises[0];
      if (exercise) {
        return {
          target: {
            type: "ACTIVITY",
            id: exercise.id,
            title: this.exerciseTitle(exercise.prompt),
            phase: exercise.phase,
            estimated_minutes: this.targetMinutes(
              Math.min(12, exercise.lesson.durationMinutes),
              original?.estimated_minutes
            ),
            difficulty: exercise.difficulty
          },
          metadata: {
            source: "ACTIVE_EXERCISE",
            entityType: "Exercise",
            entityId: exercise.id,
            originalSemanticTargetId
          }
        };
      }
      return this.currentExerciseTarget(context, originalSemanticTargetId, original?.estimated_minutes);
    }

    return this.currentLessonTarget(context, originalSemanticTargetId, original?.estimated_minutes);
  }

  private lessonTarget(
    lesson: { id: string; title: string; durationMinutes: number },
    phase: RecommendationTarget["phase"],
    originalSemanticTargetId: string | null,
    estimatedMinutes?: number
  ): RecommendationTargetResolution {
    return {
      target: {
        type: "LESSON_PHASE",
        id: lesson.id,
        title: lesson.title,
        phase,
        estimated_minutes: this.targetMinutes(lesson.durationMinutes, estimatedMinutes)
      },
      metadata: {
        source: "ACTIVE_LESSON",
        entityType: "Lesson",
        entityId: lesson.id,
        originalSemanticTargetId
      }
    };
  }

  private currentLessonTarget(
    context: RecommendationTargetContext,
    originalSemanticTargetId: string | null,
    estimatedMinutes?: number
  ): RecommendationTargetResolution {
    return {
      target: {
        type: "LESSON_PHASE",
        id: context.currentLesson.id,
        title: context.currentLesson.title,
        phase: "THEORY",
        estimated_minutes: this.targetMinutes(context.currentLesson.durationMinutes, estimatedMinutes)
      },
      metadata: {
        source: "CURRENT_LESSON",
        entityType: "Lesson",
        entityId: context.currentLesson.id,
        originalSemanticTargetId
      }
    };
  }

  private currentExerciseTarget(
    context: RecommendationTargetContext,
    originalSemanticTargetId: string | null,
    estimatedMinutes?: number
  ): RecommendationTargetResolution {
    return {
      target: {
        type: "ACTIVITY",
        id: context.currentExercise.id,
        title: this.exerciseTitle(context.currentExercise.prompt),
        phase: context.currentExercise.phase,
        estimated_minutes: this.targetMinutes(10, estimatedMinutes),
        difficulty: context.currentExercise.difficulty
      },
      metadata: {
        source: "CURRENT_EXERCISE",
        entityType: "Exercise",
        entityId: context.currentExercise.id,
        originalSemanticTargetId
      }
    };
  }

  private targetMinutes(fallback: number, preferred?: number): number {
    return Math.max(1, Math.min(180, Math.round(preferred ?? fallback)));
  }

  private exerciseTitle(prompt: string): string {
    const compact = prompt.replace(/\s+/g, " ").trim();
    return compact.length <= 180 ? compact : `${compact.slice(0, 177)}...`;
  }

  private async activeEnrollment(userId: string, courseId?: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        ...(courseId ? { courseId } : {}),
        student: { userId, status: "ACTIVE", deletedAt: null }
      },
      orderBy: { enrolledAt: "desc" },
      include: {
        student: {
          select: { learningGoal: true, weeklyAvailabilityMinutes: true }
        }
      }
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
