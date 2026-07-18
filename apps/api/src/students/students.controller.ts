import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../database/prisma.service";
import { LessonProgressService, type ProgressLessonDefinition } from "./lesson-progress.service";

function objectJson(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  return value && !Array.isArray(value) && typeof value === "object"
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

function stringValue(...values: Array<Prisma.JsonValue | undefined>): string | null {
  const value = values.find((candidate) => typeof candidate === "string" && candidate.trim());
  return typeof value === "string" ? value : null;
}

function presentationDto(type: string, contentValue: Prisma.JsonValue, metadataValue: Prisma.JsonValue) {
  const content = objectJson(contentValue);
  const metadata = objectJson(metadataValue);
  const embeddedAnimation = objectJson(content.animation ?? {});
  const animationData = objectJson(content.animationData ?? embeddedAnimation.data ?? metadata.animationData ?? {});
  const animationTemplate = stringValue(
    content.animationTemplate,
    content.template,
    embeddedAnimation.template,
    metadata.animationTemplate
  );
  const narration = stringValue(content.narration, metadata.narration);
  const mediaUrl = stringValue(content.url, content.src, content.mediaUrl, metadata.url);
  const posterAssetKey = stringValue(content.posterAssetKey, metadata.posterAssetKey);
  const normalized = type.toUpperCase();
  const mode = animationTemplate || normalized.includes("ANIMATION")
    ? "ANIMATION"
    : normalized.includes("VIDEO")
      ? "VIDEO"
      : normalized.includes("PDF") || normalized.includes("DOC") || normalized.includes("DOCUMENT")
        ? "DOCUMENT"
        : normalized.includes("CODE")
          ? "CODE"
          : "LECTURE";
  return {
    mode,
    animation: animationTemplate
      ? { template: animationTemplate, data: animationData, narration }
      : null,
    media: mediaUrl ? { url: mediaUrl, posterAssetKey } : null,
    narration,
    interactive: mode === "ANIMATION" || mode === "CODE"
  };
}

@ApiTags("students")
@ApiBearerAuth()
@Roles("STUDENT")
@UseGuards(AuthGuard, RolesGuard)
@Controller("students/me")
export class StudentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessonProgress: LessonProgressService
  ) {}

  @Get("dashboard")
  async dashboard(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>> {
    const context = await this.studentContext(request.user.id);
    const enrollment = context.enrollments[0]!;
    const since = new Date(Date.now() - 6 * 86_400_000);
    since.setHours(0, 0, 0, 0);
    const [states, dueReviews, latestRun, events, badges] = await Promise.all([
      this.prisma.studentConceptState.findMany({
        where: { studentProfileId: context.id, concept: { domainId: enrollment.course.domainId } },
        include: { concept: true },
        orderBy: { mastery: "asc" }
      }),
      this.prisma.reviewSchedule.count({
        where: { studentProfileId: context.id, status: { in: ["DUE", "SCHEDULED"] }, dueAt: { lte: new Date() } }
      }),
      this.prisma.personalizationRun.findFirst({
        where: { studentProfileId: context.id },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.learningEvent.findMany({
        where: { userId: request.user.id, occurredAt: { gte: since } },
        select: { occurredAt: true, payloadJson: true }
      }),
      this.prisma.studentBadge.findMany({
        where: { userId: request.user.id },
        include: { badge: true },
        orderBy: { awardedAt: "desc" },
        take: 3
      })
    ]);
    const focus = states[0];
    const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(since.getTime() + index * 86_400_000);
      const next = new Date(day.getTime() + 86_400_000);
      return events
        .filter((event) => event.occurredAt >= day && event.occurredAt < next)
        .reduce((sum, event) => {
          const payload = objectJson(event.payloadJson);
          return sum + (typeof payload.durationMinutes === "number" ? payload.durationMinutes : 5);
        }, 0);
    });
    return {
      student: {
        id: request.user.id,
        name: context.user.displayName,
        nickname: context.user.nickname ?? context.user.displayName,
        xp: context.xp,
        level: context.level,
        streak: context.streakDays,
        avatar: context.user.avatarKey
      },
      goal: this.goalDto(context),
      course: {
        id: enrollment.course.id,
        code: enrollment.course.code,
        title: enrollment.course.title,
        progress: enrollment.progress,
        cover: enrollment.course.coverAssetKey
      },
      focus: focus
        ? {
            conceptCode: focus.concept.code,
            mastery: focus.mastery,
            reason: `Mastery ${Math.round(focus.mastery * 100)}% và nguy cơ quên ${Math.round(focus.forgettingRisk * 100)}%`
          }
        : null,
      dueReviews,
      recommendationMode: latestRun?.mode ?? "WAITING_FOR_FIRST_ATTEMPT",
      weeklyActivity,
      badges: badges.map((item) => item.badge.assetKey)
    };
  }

  @Post("goals")
  async goals(
    @Req() request: AuthenticatedRequest,
    @Body() body: { objective?: string; weeks?: number; weeklyMinutes?: number }
  ): Promise<Record<string, unknown>> {
    const profile = await this.studentContext(request.user.id);
    const metadata = objectJson(profile.metadataJson);
    const updated = await this.prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        learningGoal: body.objective ?? profile.learningGoal,
        weeklyAvailabilityMinutes: body.weeklyMinutes ?? profile.weeklyAvailabilityMinutes,
        metadataJson: {
          ...metadata,
          goalWeeks: body.weeks ?? (typeof metadata.goalWeeks === "number" ? metadata.goalWeeks : 4),
          goalUpdatedAt: new Date().toISOString()
        }
      }
    });
    return { saved: true, goal: this.goalDto(updated), pathRegenerated: true };
  }

  @Get("path")
  async path(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>> {
    const context = await this.studentContext(request.user.id);
    const enrollment = context.enrollments[0]!;
    const [concepts, activeRecommendation] = await Promise.all([
      this.prisma.learningConcept.findMany({
        where: { domainId: enrollment.course.domainId, status: "ACTIVE", deletedAt: null },
        include: {
          studentStates: { where: { studentProfileId: context.id } },
          lessons: { where: { module: { courseId: enrollment.courseId }, status: "ACTIVE", deletedAt: null }, orderBy: { order: "asc" } }
        },
        orderBy: { order: "asc" }
      }),
      this.prisma.recommendation.findFirst({
        where: { studentProfileId: context.id, status: "ACTIVE" },
        orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }]
      })
    ]);
    return {
      version: `db-path-${context.updatedAt.getTime()}`,
      goal: this.goalDto(context),
      nodes: concepts.map((concept) => {
        const state = concept.studentStates[0];
        const isCurrent = activeRecommendation?.conceptId === concept.id;
        return {
          id: concept.id,
          conceptCode: concept.code,
          title: concept.title,
          state: isCurrent ? "CURRENT" : (state?.mastery ?? 0) >= 0.65 ? "COMPLETED" : "AVAILABLE",
          mastery: state?.mastery ?? 0,
          activity: isCurrent ? activeRecommendation?.action : "LESSON",
          lessonId: concept.lessons[0]?.id,
          reviewable: true
        };
      })
    };
  }

  @Get("concepts")
  async conceptStates(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>[]> {
    const context = await this.studentContext(request.user.id);
    const enrollment = context.enrollments[0]!;
    const concepts = await this.prisma.learningConcept.findMany({
      where: { domainId: enrollment.course.domainId, status: "ACTIVE", deletedAt: null },
      include: { studentStates: { where: { studentProfileId: context.id } } },
      orderBy: { order: "asc" }
    });
    return concepts.map((concept) => {
      const state = concept.studentStates[0];
      return {
        id: concept.id,
        code: concept.code,
        title: concept.title,
        mastery: state?.mastery ?? 0,
        retrievability: state?.retrievability ?? 0,
        forgettingRisk: state?.forgettingRisk ?? 1,
        stability: state?.stability ?? 0,
        updatedAt: state?.updatedAt.toISOString() ?? null
      };
    });
  }

  @Get("reviews")
  async reviews(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>> {
    const context = await this.studentContext(request.user.id);
    const schedule = await this.prisma.reviewSchedule.findMany({
      where: { studentProfileId: context.id, status: { in: ["SCHEDULED", "DUE"] } },
      include: { concept: true, recommendation: true },
      orderBy: { dueAt: "asc" }
    });
    const dueContent = await this.prisma.generatedContent.findMany({
      where: {
        status: "PUBLISHED",
        microLesson: { conceptId: { in: schedule.map((item) => item.conceptId) }, status: "PUBLISHED" }
      },
      select: { id: true, title: true, microLesson: { select: { conceptId: true, durationMinutes: true } } }
    });
    return {
      due: dueContent,
      schedule: schedule.map((item) => ({
        id: item.id,
        conceptCode: item.concept.code,
        title: item.concept.title,
        dueAt: item.dueAt.toISOString(),
        intervalDays: item.intervalDays,
        reason: objectJson(item.metadataJson).reason ?? "Lịch ôn được cá nhân hóa",
        recommendationId: item.recommendationId
      }))
    };
  }

  @Get("recommendations")
  async recommendations(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>[]> {
    const context = await this.studentContext(request.user.id);
    const rows = await this.prisma.recommendation.findMany({
      where: { studentProfileId: context.id },
      include: { concept: true, evidence: true },
      orderBy: [{ status: "asc" }, { priorityScore: "desc" }, { createdAt: "desc" }],
      take: 30
    });
    return rows.map((row) => ({
      id: row.id,
      conceptCode: row.concept.code,
      conceptTitle: row.concept.title,
      action: row.action,
      priorityScore: row.priorityScore,
      reasons: row.reasonsJson,
      target: row.targetId ? { type: row.targetType, id: row.targetId, phase: row.targetPhase, estimatedMinutes: row.estimatedMinutes } : null,
      status: row.status,
      modelVersion: row.modelVersion,
      evidence: row.evidence,
      createdAt: row.createdAt.toISOString()
    }));
  }

  @Get("progress")
  async progress(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>> {
    const context = await this.studentContext(request.user.id);
    const [history, attempts, events] = await Promise.all([
      this.prisma.conceptStateHistory.findMany({
        where: { studentProfileId: context.id },
        orderBy: { recordedAt: "asc" }
      }),
      this.prisma.attempt.findMany({ where: { userId: request.user.id } }),
      this.prisma.learningEvent.findMany({ where: { userId: request.user.id }, select: { payloadJson: true } })
    ]);
    const weekly = new Map<string, { sum: number; retention: number; count: number }>();
    for (const item of history) {
      const start = new Date(item.recordedAt);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      const key = start.toISOString().slice(0, 10);
      const bucket = weekly.get(key) ?? { sum: 0, retention: 0, count: 0 };
      bucket.sum += item.mastery;
      bucket.retention += item.retrievability;
      bucket.count += 1;
      weekly.set(key, bucket);
    }
    return {
      masteryHistory: [...weekly.entries()].slice(-8).map(([week, value]) => ({
        week,
        mastery: Number((value.sum / value.count).toFixed(3)),
        retention: Number((value.retention / value.count).toFixed(3))
      })),
      studyMinutes: events.reduce((sum, event) => {
        const minutes = objectJson(event.payloadJson).durationMinutes;
        return sum + (typeof minutes === "number" ? minutes : 0);
      }, 0),
      exercisesCompleted: attempts.length,
      reviewAccuracy: attempts.length ? attempts.filter((item) => item.isCorrect).length / attempts.length : 0
    };
  }

  @Get("location")
  async location(@Req() request: AuthenticatedRequest) {
    const context = await this.studentContext(request.user.id);
    return this.lessonProgress.snapshot(request.user.id, context.enrollments[0]!.courseId);
  }

  @Get("leaderboard")
  async leaderboard(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>> {
    const context = await this.studentContext(request.user.id);
    const enrollment = context.enrollments[0]!;
    const students = await this.prisma.enrollment.findMany({
      where: { classId: enrollment.classId, courseId: enrollment.courseId, status: "ACTIVE", deletedAt: null },
      include: { student: { include: { user: true, conceptStates: { where: { concept: { domainId: enrollment.course.domainId } } } } } }
    });
    const rows = students.map((item) => ({
      id: item.student.userId,
      name: item.student.user.nickname ?? item.student.user.displayName,
      xp: item.student.xp,
      streak: item.student.streakDays,
      progress: item.progress,
      mastery: item.student.conceptStates.length
        ? item.student.conceptStates.reduce((sum, state) => sum + state.mastery, 0) / item.student.conceptStates.length
        : 0
    }));
    return {
      enabled: enrollment.class.leaderboardEnabled,
      boards: {
        class: [...rows].sort((a, b) => b.xp - a.xp).slice(0, 10),
        mostImproved: [...rows].sort((a, b) => b.progress - a.progress).slice(0, 10),
        recallMaster: [...rows].sort((a, b) => b.streak - a.streak).slice(0, 10)
      }
    };
  }

  private async studentContext(userId: string) {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId, status: "ACTIVE", deletedAt: null },
      include: {
        user: true,
        enrollments: {
          where: { status: "ACTIVE", deletedAt: null },
          include: { course: true, class: true },
          orderBy: { enrolledAt: "desc" },
          take: 1
        }
      }
    });
    if (!profile || !profile.enrollments[0]) throw new NotFoundException("Không tìm thấy hồ sơ học tập đang hoạt động");
    return profile;
  }

  private goalDto(profile: { learningGoal: string | null; weeklyAvailabilityMinutes: number; metadataJson: Prisma.JsonValue }) {
    const metadata = objectJson(profile.metadataJson);
    return {
      objective: profile.learningGoal ?? "Hoàn thành khóa học",
      weeks: typeof metadata.goalWeeks === "number" ? metadata.goalWeeks : 4,
      weeklyMinutes: profile.weeklyAvailabilityMinutes
    };
  }
}

@ApiTags("courses")
@ApiBearerAuth()
@Roles("STUDENT", "TEACHER")
@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class CoursesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessonProgress: LessonProgressService
  ) {}

  @Get("courses/:id")
  async course(@Req() request: AuthenticatedRequest, @Param("id") id: string): Promise<Record<string, unknown>> {
    const course = await this.prisma.course.findFirst({
      where: { OR: [{ id }, { code: id }], status: "ACTIVE", deletedAt: null },
      include: {
        modules: {
          where: { status: "ACTIVE", deletedAt: null },
          orderBy: { order: "asc" },
          include: {
            lessons: {
              where: { status: "ACTIVE", deletedAt: null },
              orderBy: { order: "asc" },
              include: {
                concept: true,
                resources: {
                  where: { status: "ACTIVE", deletedAt: null },
                  select: { id: true, phase: true }
                },
                exercises: {
                  where: { status: "ACTIVE", deletedAt: null },
                  select: { id: true, phase: true }
                }
              }
            }
          }
        }
      }
    });
    if (!course) throw new NotFoundException("Course not found");
    const metadata = objectJson(course.metadataJson);
    const lessonDefinitions: ProgressLessonDefinition[] = course.modules.flatMap((module) =>
      module.lessons.map((lesson) => ({
        id: lesson.id,
        moduleId: module.id,
        moduleOrder: module.order,
        order: lesson.order,
        resources: lesson.resources,
        exercises: lesson.exercises
      }))
    );
    const learnerProgress = request.user.role === "STUDENT"
      ? await this.lessonProgress.snapshot(request.user.id, course.id, lessonDefinitions)
      : null;
    const progressByLesson = new Map(learnerProgress?.lessons.map((item) => [item.lessonId, item]) ?? []);
    return {
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description,
      audience: metadata.audience ?? "Học sinh K-12 Việt Nam",
      durationMinutes: course.estimatedHours * 60,
      cadence: metadata.cadence ?? "2–3 buổi/tuần",
      finalProduct: metadata.finalProduct ?? "Dự án cuối khóa",
      cover: course.coverAssetKey,
      learnerProgress: learnerProgress
        ? {
            progress: learnerProgress.progress,
            storedEnrollmentProgress: learnerProgress.storedEnrollmentProgress,
            completedLessons: learnerProgress.completedLessons,
            totalLessons: learnerProgress.totalLessons,
            courseCompleted: learnerProgress.courseCompleted
          }
        : null,
      currentLocation: learnerProgress?.currentLocation ?? null,
      modules: course.modules.map((module) => ({
        id: module.id,
        code: module.code,
        title: module.title,
        description: module.description,
        order: module.order,
        status: (() => {
          const statuses = module.lessons.map((lesson) => progressByLesson.get(lesson.id)?.status);
          if (statuses.length && statuses.every((status) => status === "COMPLETED")) return "COMPLETED";
          if (statuses.some((status) => status === "CURRENT")) return "CURRENT";
          if (statuses.length && statuses.every((status) => status === "LOCKED")) return "LOCKED";
          return "AVAILABLE";
        })(),
        lessons: module.lessons.map((lesson) => ({
          id: lesson.id,
          code: lesson.code,
          title: lesson.title,
          summary: lesson.summary,
          conceptCode: lesson.concept.code,
          durationMinutes: lesson.durationMinutes,
          status: progressByLesson.get(lesson.id)?.status ?? "AVAILABLE",
          progress: progressByLesson.get(lesson.id)?.progress ?? null,
          reviewable: true,
          phases: [
            {
              phase: "THEORY",
              activityTypes: ["LECTURE", "ANIMATION", "DOCUMENT"],
              activities: lesson.resources.filter((item) => item.phase === "THEORY").length,
              progress: progressByLesson.get(lesson.id)?.phases.find((item) => item.phase === "THEORY") ?? null
            },
            {
              phase: "PRACTICE",
              activityTypes: ["CODE", "MULTIPLE_CHOICE", "DEBUG"],
              activities: lesson.exercises.filter((item) => item.phase === "PRACTICE").length,
              progress: progressByLesson.get(lesson.id)?.phases.find((item) => item.phase === "PRACTICE") ?? null
            },
            {
              phase: "CHECKPOINT",
              activityTypes: ["MULTIPLE_CHOICE", "CODE"],
              activities: lesson.exercises.filter((item) => item.phase === "CHECKPOINT").length,
              progress: progressByLesson.get(lesson.id)?.phases.find((item) => item.phase === "CHECKPOINT") ?? null
            }
          ],
          order: lesson.order
        }))
      }))
    };
  }

  @Get("lessons/:id")
  async lesson(@Req() request: AuthenticatedRequest, @Param("id") id: string): Promise<Record<string, unknown>> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { OR: [{ id }, { code: id }], status: "ACTIVE", deletedAt: null },
      include: {
        concept: true,
        module: true,
        resources: { where: { status: "ACTIVE", deletedAt: null }, orderBy: { createdAt: "asc" } },
        exercises: { where: { status: "ACTIVE", deletedAt: null }, orderBy: [{ phase: "asc" }, { difficulty: "asc" }] }
      }
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
    const theory = lesson.resources.filter((item) => item.phase === "THEORY");
    const practice = lesson.exercises.filter((item) => item.phase === "PRACTICE");
    const checkpoint = lesson.exercises.filter((item) => item.phase === "CHECKPOINT");
    const learnerSnapshot = request.user.role === "STUDENT"
      ? await this.lessonProgress.snapshot(request.user.id, lesson.module.courseId)
      : null;
    const learnerProgress = learnerSnapshot?.lessons.find((item) => item.lessonId === lesson.id) ?? null;
    return {
      id: lesson.id,
      code: lesson.code,
      title: lesson.title,
      summary: lesson.summary,
      conceptCode: lesson.concept.code,
      moduleId: lesson.moduleId,
      order: lesson.order,
      durationMinutes: lesson.durationMinutes,
      objectives: objectJson(lesson.metadataJson).objectives ?? [lesson.summary],
      reviewable: true,
      status: learnerProgress?.status ?? "AVAILABLE",
      progress: learnerProgress?.progress ?? null,
      currentPhase: learnerProgress?.phases.find((item) => item.status === "CURRENT")?.phase ?? null,
      currentLocation: learnerSnapshot?.currentLocation?.lessonId === lesson.id
        ? learnerSnapshot.currentLocation
        : null,
      sections: [
        {
          phase: "THEORY",
          title: "Lý thuyết",
          progress: learnerProgress?.phases.find((item) => item.phase === "THEORY") ?? null,
          resources: theory.map((item) => ({
            id: item.id,
            type: item.type,
            title: item.title,
            content: item.contentJson,
            presentation: presentationDto(item.type, item.contentJson, item.metadataJson)
          }))
        },
        {
          phase: "PRACTICE",
          title: "Thực hành",
          progress: learnerProgress?.phases.find((item) => item.phase === "PRACTICE") ?? null,
          activities: practice.map((item) => ({
            id: item.id,
            code: item.code,
            type: item.type,
            prompt: item.prompt,
            difficulty: item.difficulty,
            content: item.contentJson,
            presentation: presentationDto(item.type, item.contentJson, item.metadataJson)
          }))
        },
        {
          phase: "CHECKPOINT",
          title: "Kiểm tra cuối bài",
          progress: learnerProgress?.phases.find((item) => item.phase === "CHECKPOINT") ?? null,
          activities: checkpoint.map((item) => ({
            id: item.id,
            code: item.code,
            type: item.type,
            prompt: item.prompt,
            difficulty: item.difficulty,
            content: item.contentJson,
            presentation: presentationDto(item.type, item.contentJson, item.metadataJson)
          })),
          passRule: { minimumCorrect: Math.max(1, Math.ceil(checkpoint.length * 0.67)), totalQuestions: checkpoint.length },
          updatesPath: true
        }
      ]
    };
  }
}
