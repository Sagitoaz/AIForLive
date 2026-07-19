import { Body, Controller, Get, NotFoundException, Param, Patch, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ClassTeacherRole, Prisma } from "@prisma/client";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../database/prisma.service";

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function objectJson(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  return value && !Array.isArray(value) && typeof value === "object"
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

const allTeacherClassRoles: ClassTeacherRole[] = [
  ClassTeacherRole.OWNER,
  ClassTeacherRole.INSTRUCTOR,
  ClassTeacherRole.REVIEWER
];

const learnerDataRoles: ClassTeacherRole[] = [
  ClassTeacherRole.OWNER,
  ClassTeacherRole.INSTRUCTOR
];

function teacherClassAccess(
  userId: string,
  roles: ClassTeacherRole[] = allTeacherClassRoles
): Prisma.LearningClassWhereInput {
  const accessPaths: Prisma.LearningClassWhereInput[] = [];
  if (roles.includes(ClassTeacherRole.OWNER)) {
    accessPaths.push({ teacher: { userId, status: "ACTIVE", deletedAt: null } });
  }
  accessPaths.push({
    teacherMemberships: {
      some: {
        teacher: { userId, status: "ACTIVE", deletedAt: null },
        role: { in: roles },
        status: "ACTIVE",
        deletedAt: null
      }
    }
  });
  return {
    status: "ACTIVE",
    deletedAt: null,
    OR: accessPaths
  };
}

@ApiTags("teacher")
@ApiBearerAuth()
@Roles("TEACHER")
@UseGuards(AuthGuard, RolesGuard)
@Controller("teacher")
export class TeacherController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("dashboard")
  async dashboard(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>> {
    const context = await this.teacherContext(request.user.id);
    const learningClass = context.classes[0]!;
    const enrollmentIds = learningClass.enrollments.map((item) => item.studentProfileId);
    const userIds = learningClass.enrollments.map((item) => item.student.userId);
    const courseIds = [...new Set(learningClass.enrollments.map((item) => item.courseId))];
    const domainIds = [...new Set(learningClass.enrollments.map((item) => item.course.domainId))];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [states, activeToday, fallbackAnalyses, dueReviews, diagnoses, reviewQueue] = await Promise.all([
      this.prisma.studentConceptState.findMany({
        where: { studentProfileId: { in: enrollmentIds }, concept: { domainId: { in: domainIds } } },
        include: { concept: true }
      }),
      this.prisma.learningEvent.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds }, courseId: { in: courseIds }, occurredAt: { gte: today } }
      }),
      this.prisma.personalizationRun.count({
        where: { studentProfileId: { in: enrollmentIds }, mode: "DETERMINISTIC_FALLBACK", learningEvent: { courseId: { in: courseIds } } }
      }),
      this.prisma.reviewSchedule.count({
        where: { studentProfileId: { in: enrollmentIds }, concept: { domainId: { in: domainIds } }, status: { in: ["DUE", "SCHEDULED"] }, dueAt: { lte: new Date() } }
      }),
      this.prisma.attemptDiagnosis.findMany({
        where: { attempt: { userId: { in: userIds }, event: { courseId: { in: courseIds } } }, misconceptionId: { not: null } },
        include: { misconception: true, attempt: true }
      }),
      this.prisma.generatedContent.count({
        where: {
          generationJob: { courseId: { in: courseIds } },
          status: { in: ["DRAFT", "IN_REVIEW", "REVISION_REQUIRED", "APPROVED"] }
        }
      })
    ]);
    const byConcept = new Map<string, { code: string; title: string; values: number[] }>();
    const byStudent = new Map<string, number[]>();
    for (const state of states) {
      const bucket = byConcept.get(state.conceptId) ?? { code: state.concept.code, title: state.concept.title, values: [] };
      bucket.values.push(state.mastery);
      byConcept.set(state.conceptId, bucket);
      byStudent.set(state.studentProfileId, [...(byStudent.get(state.studentProfileId) ?? []), state.mastery]);
    }
    const studentAverages = enrollmentIds.map((studentId) => average(byStudent.get(studentId) ?? []));
    const misconceptionMap = new Map<string, { code: string; studentIds: Set<string>; attempts: number }>();
    for (const diagnosis of diagnoses) {
      if (!diagnosis.misconception) continue;
      const bucket = misconceptionMap.get(diagnosis.misconception.id) ?? {
        code: diagnosis.misconception.code,
        studentIds: new Set<string>(),
        attempts: 0
      };
      bucket.studentIds.add(diagnosis.attempt.userId);
      bucket.attempts += 1;
      misconceptionMap.set(diagnosis.misconception.id, bucket);
    }
    return {
      class: { id: learningClass.id, name: learningClass.name, students: learningClass.enrollments.length },
      averageMastery: average(states.map((item) => item.mastery)),
      activeToday: activeToday.length,
      needsSupport: studentAverages.filter((value) => value < 0.45).length,
      dueReviews,
      fallbackAnalyses,
      topGaps: [...byConcept.values()]
        .map((item) => ({ conceptCode: item.code, title: item.title, mastery: average(item.values), students: item.values.filter((value) => value < 0.5).length }))
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, 5),
      misconceptions: [...misconceptionMap.values()]
        .map((item) => ({ code: item.code, students: item.studentIds.size, attempts: item.attempts }))
        .sort((a, b) => b.students - a.students),
      reviewQueue
    };
  }

  @Get("classes")
  async classes(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>[]> {
    const context = await this.teacherContext(request.user.id);
    return Promise.all(context.classes.map(async (learningClass) => {
      const studentIds = learningClass.enrollments.map((item) => item.studentProfileId);
      const courseIds = [...new Set(learningClass.enrollments.map((item) => item.courseId))];
      const domainIds = [...new Set(learningClass.enrollments.map((item) => item.course.domainId))];
      const states = await this.prisma.studentConceptState.findMany({ where: { studentProfileId: { in: studentIds }, concept: { domainId: { in: domainIds } } } });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const active = await this.prisma.learningEvent.groupBy({
        by: ["userId"],
        where: { userId: { in: learningClass.enrollments.map((item) => item.student.userId) }, courseId: { in: courseIds }, occurredAt: { gte: today } }
      });
      return {
        id: learningClass.id,
        code: learningClass.code,
        name: learningClass.name,
        course: learningClass.enrollments[0]?.course.title ?? null,
        students: learningClass.enrollments.length,
        averageMastery: average(states.map((item) => item.mastery)),
        activeToday: active.length
      };
    }));
  }

  @Get("classes/:id")
  async classDetail(@Req() request: AuthenticatedRequest, @Param("id") id: string): Promise<Record<string, unknown>> {
    const learningClass = await this.ownedClass(id, request.user.id);
    const domainIds = [...new Set(learningClass.enrollments.map((item) => item.course.domainId))];
    const states = await this.prisma.studentConceptState.findMany({
      where: { studentProfileId: { in: learningClass.enrollments.map((item) => item.studentProfileId) }, concept: { domainId: { in: domainIds } } }
    });
    return {
      id: learningClass.id,
      name: learningClass.name,
      leaderboardEnabled: learningClass.leaderboardEnabled,
      course: learningClass.enrollments[0]?.course
        ? {
            id: learningClass.enrollments[0].course.id,
            code: learningClass.enrollments[0].course.code,
            title: learningClass.enrollments[0].course.title
          }
        : null,
      students: learningClass.enrollments.map((item) => {
        const studentStates = states.filter((state) => state.studentProfileId === item.studentProfileId);
        return {
          id: item.student.userId,
          profileId: item.student.id,
          name: item.student.user.displayName,
          nickname: item.student.user.nickname,
          avatar: item.student.user.avatarKey,
          xp: item.student.xp,
          streak: item.student.streakDays,
          progress: item.progress,
          mastery: average(studentStates.map((state) => state.mastery)),
          needsSupport: average(studentStates.map((state) => state.mastery)) < 0.45,
          goal: item.student.learningGoal,
          dataQualityFlags: objectJson(item.student.metadataJson).dataQualityFlags ?? []
        };
      })
    };
  }

  @Get("classes/:id/heatmap")
  async heatmap(@Req() request: AuthenticatedRequest, @Param("id") id: string): Promise<Record<string, unknown>> {
    const learningClass = await this.ownedClass(id, request.user.id);
    const domainId = learningClass.enrollments[0]?.course.domainId;
    const concepts = await this.prisma.learningConcept.findMany({
      where: { domainId, status: "ACTIVE", deletedAt: null },
      orderBy: { order: "asc" }
    });
    const states = await this.prisma.studentConceptState.findMany({
      where: { studentProfileId: { in: learningClass.enrollments.map((item) => item.studentProfileId) }, conceptId: { in: concepts.map((item) => item.id) } }
    });
    return {
      classId: learningClass.id,
      concepts: concepts.map((item) => ({ id: item.id, code: item.code, title: item.title })),
      rows: learningClass.enrollments.map((item) => ({
        studentId: item.student.userId,
        name: item.student.user.displayName,
        values: concepts.map((concept) => {
          const state = states.find((candidate) => candidate.studentProfileId === item.studentProfileId && candidate.conceptId === concept.id);
          return { conceptCode: concept.code, mastery: state?.mastery ?? null, dataAvailable: Boolean(state) };
        })
      }))
    };
  }

  @Get("classes/:id/gaps")
  async gaps(@Req() request: AuthenticatedRequest, @Param("id") id: string): Promise<Record<string, unknown>> {
    const heatmap = await this.heatmap(request, id) as { classId: string; concepts: Array<{ code: string; title: string }>; rows: Array<{ values: Array<{ conceptCode: string; mastery: number | null }> }> };
    return {
      classId: heatmap.classId,
      concepts: heatmap.concepts.map((concept) => {
        const values = heatmap.rows.flatMap((row) => row.values.filter((item) => item.conceptCode === concept.code && item.mastery !== null).map((item) => item.mastery as number));
        return {
          code: concept.code,
          title: concept.title,
          averageMastery: average(values),
          affectedStudents: values.filter((value) => value < 0.5).length
        };
      }).sort((a, b) => a.averageMastery - b.averageMastery)
    };
  }

  @Get("students/:id")
  async student(@Req() request: AuthenticatedRequest, @Param("id") id: string): Promise<Record<string, unknown>> {
    const profile = await this.ownedStudent(id, request.user.id);
    const authorizedCourseIds = profile.enrollments.map((enrollment) => enrollment.courseId);
    const authorizedDomainIds = [...new Set(profile.enrollments.map((enrollment) => enrollment.course.domainId))];
    const conceptStates = await this.prisma.studentConceptState.findMany({
      where: { studentProfileId: profile.id, concept: { domainId: { in: authorizedDomainIds } } },
      include: { concept: true },
      orderBy: { concept: { order: "asc" } }
    });
    const timeline = await this.prisma.attempt.findMany({
      where: { userId: profile.userId, event: { courseId: { in: authorizedCourseIds } } },
      include: { exercise: true, diagnoses: { include: { misconception: true } }, event: { include: { personalizationRun: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    const rangeHistory = await this.prisma.conceptStateHistory.findMany({
      where: { studentProfileId: profile.id, concept: { code: "PYTHON_RANGE", domainId: { in: authorizedDomainIds } } },
      orderBy: { recordedAt: "asc" }
    });
    return {
      id: profile.userId,
      profileId: profile.id,
      name: profile.user.displayName,
      nickname: profile.user.nickname,
      avatar: profile.user.avatarKey,
      xp: profile.xp,
      level: profile.level,
      streak: profile.streakDays,
      goal: profile.learningGoal,
      weeklyAvailabilityMinutes: profile.weeklyAvailabilityMinutes,
      conceptStates: conceptStates.map((state) => ({
        code: state.concept.code,
        title: state.concept.title,
        mastery: state.mastery,
        retrievability: state.retrievability,
        forgettingRisk: state.forgettingRisk,
        updatedAt: state.updatedAt.toISOString()
      })),
      timeline: timeline.map((attempt) => ({
        id: attempt.id,
        exerciseCode: attempt.exercise.code,
        isCorrect: attempt.isCorrect,
        usedHint: attempt.usedHint,
        score: attempt.score,
        diagnosis: attempt.diagnoses[0] ?? null,
        analysis: attempt.event.personalizationRun?.outputJson ?? null,
        createdAt: attempt.createdAt.toISOString()
      })),
      beforeAfter: {
        beforeReview: rangeHistory[0]?.mastery ?? null,
        afterReview: rangeHistory.at(-1)?.mastery ?? null
      }
    };
  }

  @Get("students/:id/recommendations")
  async recommendations(@Req() request: AuthenticatedRequest, @Param("id") id: string): Promise<Record<string, unknown>[]> {
    const profile = await this.ownedStudent(id, request.user.id);
    const authorizedCourseIds = profile.enrollments.map((enrollment) => enrollment.courseId);
    const authorizedDomainIds = [...new Set(profile.enrollments.map((enrollment) => enrollment.course.domainId))];
    const rows = await this.prisma.recommendation.findMany({
      where: {
        studentProfileId: profile.id,
        concept: { domainId: { in: authorizedDomainIds } },
        evidence: { some: { attempt: { event: { courseId: { in: authorizedCourseIds } } } } }
      },
      include: { concept: true, evidence: { include: { attempt: true } } },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((row) => ({
      id: row.id,
      studentId: profile.userId,
      conceptCode: row.concept.code,
      action: row.action,
      priorityScore: row.priorityScore,
      target: { type: row.targetType, id: row.targetId, phase: row.targetPhase, estimatedMinutes: row.estimatedMinutes },
      reasons: row.reasonsJson,
      candidateLog: row.candidateLogJson,
      evidence: row.evidence,
      status: row.status,
      modelVersion: row.modelVersion,
      createdAt: row.createdAt.toISOString()
    }));
  }

  @Get("recommendations/:id")
  async recommendation(@Req() request: AuthenticatedRequest, @Param("id") id: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.recommendation.findFirst({
      where: {
        id,
        student: {
          enrollments: {
            some: {
              status: "ACTIVE",
              deletedAt: null,
              class: teacherClassAccess(request.user.id, learnerDataRoles)
            }
          }
        }
      },
      include: {
        concept: true,
        student: {
          include: {
            user: true,
            enrollments: {
              where: {
                status: "ACTIVE",
                deletedAt: null,
                class: teacherClassAccess(request.user.id, learnerDataRoles)
              },
              select: { courseId: true }
            }
          }
        },
        evidence: {
          include: {
            attempt: {
              include: { diagnoses: true, event: { include: { personalizationRun: true } } }
            }
          }
        }
      }
    });
    if (!row) throw new NotFoundException("Recommendation not found");
    const authorizedCourseIds = new Set(row.student.enrollments.map((enrollment) => enrollment.courseId));
    if (!row.evidence.some((item) => item.attempt?.event && authorizedCourseIds.has(item.attempt.event.courseId))) {
      throw new NotFoundException("Recommendation not found");
    }
    return {
      id: row.id,
      student: { id: row.student.userId, name: row.student.user.displayName },
      conceptCode: row.concept.code,
      action: row.action,
      priorityScore: row.priorityScore,
      reasons: row.reasonsJson,
      candidateLog: row.candidateLogJson,
      target: { type: row.targetType, id: row.targetId, phase: row.targetPhase, estimatedMinutes: row.estimatedMinutes },
      targetResolution: objectJson(row.metadataJson).targetResolution ?? null,
      analysisInput: row.evidence.find((item) => item.attempt?.event.personalizationRun)?.attempt?.event.personalizationRun?.inputJson ?? null,
      evidence: row.evidence,
      modelVersion: row.modelVersion,
      status: row.status
    };
  }

  @Get("analytics/mastery")
  async mastery(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>> {
    const context = await this.teacherContext(request.user.id, learnerDataRoles);
    const ids = context.classes.flatMap((item) => item.enrollments.map((enrollment) => enrollment.studentProfileId));
    const domainIds = [...new Set(context.classes.flatMap((item) => item.enrollments.map((enrollment) => enrollment.course.domainId)))];
    const history = await this.prisma.conceptStateHistory.findMany({ where: { studentProfileId: { in: ids }, concept: { domainId: { in: domainIds } } }, orderBy: { recordedAt: "asc" } });
    const grouped = new Map<string, number[]>();
    for (const item of history) {
      const key = item.recordedAt.toISOString().slice(0, 10);
      grouped.set(key, [...(grouped.get(key) ?? []), item.mastery]);
    }
    const points = [...grouped.entries()].slice(-12).map(([label, values]) => ({ label, mastery: average(values) }));
    return { series: points.map((item) => item.mastery), labels: points.map((item) => item.label), change: points.length > 1 ? points.at(-1)!.mastery - points[0]!.mastery : 0 };
  }

  @Get("analytics/misconceptions")
  async misconceptionAnalytics(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>> {
    const context = await this.teacherContext(request.user.id, learnerDataRoles);
    const userIds = context.classes.flatMap((item) => item.enrollments.map((enrollment) => enrollment.student.userId));
    const courseIds = [...new Set(context.classes.flatMap((item) => item.enrollments.map((enrollment) => enrollment.courseId)))];
    const rows = await this.prisma.attemptDiagnosis.findMany({
      where: { attempt: { userId: { in: userIds }, event: { courseId: { in: courseIds } } }, misconceptionId: { not: null } },
      include: { misconception: true, attempt: true }
    });
    const grouped = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!row.misconception) continue;
      const users = grouped.get(row.misconception.code) ?? new Set<string>();
      users.add(row.attempt.userId);
      grouped.set(row.misconception.code, users);
    }
    return { grouped: [...grouped.entries()].map(([code, users]) => ({ code, students: users.size, attempts: rows.filter((row) => row.misconception?.code === code).length })) };
  }

  @Get("analytics/content-production")
  async production(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>> {
    const rows = await this.prisma.generatedContent.findMany({
      where: { generationJob: { requestedById: request.user.id } },
      include: { generationJob: true }
    });
    return {
      generated: rows.length,
      published: rows.filter((item) => item.status === "PUBLISHED").length,
      averageGenerationMs: average(rows.map((item) => item.generationJob.durationMs ?? 0)),
      averageTeacherEditingSeconds: average(rows.map((item) => item.teacherEditingSeconds)),
      reuseCount: rows.reduce((sum, item) => sum + item.reuseCount, 0),
      estimatedCostUsd: rows.reduce((sum, item) => sum + item.generationJob.estimatedCostUsd, 0),
      providers: [...new Set(rows.map((item) => item.provider))]
    };
  }

  @Get("analytics/retention")
  async retention(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>> {
    const context = await this.teacherContext(request.user.id, learnerDataRoles);
    const ids = context.classes.flatMap((item) => item.enrollments.map((enrollment) => enrollment.studentProfileId));
    const domainIds = [...new Set(context.classes.flatMap((item) => item.enrollments.map((enrollment) => enrollment.course.domainId)))];
    const states = await this.prisma.studentConceptState.findMany({ where: { studentProfileId: { in: ids }, concept: { domainId: { in: domainIds } } } });
    const schedules = await this.prisma.reviewSchedule.findMany({ where: { studentProfileId: { in: ids }, concept: { domainId: { in: domainIds } } } });
    return {
      averageRetrievability: average(states.map((item) => item.retrievability)),
      dueIn24Hours: schedules.filter((item) => item.dueAt <= new Date(Date.now() + 86_400_000) && item.status !== "COMPLETED").length,
      successfulReviews: schedules.length ? schedules.filter((item) => item.status === "COMPLETED").length / schedules.length : 0,
      intervals: {
        oneDay: schedules.filter((item) => item.intervalDays <= 1).length,
        threeDays: schedules.filter((item) => item.intervalDays > 1 && item.intervalDays <= 3).length,
        sevenDays: schedules.filter((item) => item.intervalDays > 3).length
      }
    };
  }

  @Get("analytics/models")
  async modelStatus(): Promise<Record<string, unknown>> {
    const models = await this.prisma.modelVersion.findMany({
      include: { evaluations: { orderBy: { evaluatedAt: "desc" }, take: 1 } },
      orderBy: { activatedAt: "desc" }
    });
    return {
      models: models.map((model) => ({
        code: model.code,
        version: model.version,
        status: model.status,
        algorithm: model.algorithm,
        trainedAt: model.trainedAt.toISOString(),
        evaluation: model.evaluations[0] ?? null
      }))
    };
  }

  @Patch("leaderboard/settings")
  async settings(@Req() request: AuthenticatedRequest, @Body("enabled") enabled: boolean): Promise<Record<string, unknown>> {
    const context = await this.teacherContext(request.user.id, [ClassTeacherRole.OWNER]);
    const updated = await this.prisma.learningClass.update({
      where: { id: context.classes[0]!.id },
      data: { leaderboardEnabled: Boolean(enabled) }
    });
    return { enabled: updated.leaderboardEnabled, updatedAt: updated.updatedAt.toISOString() };
  }

  private async teacherContext(userId: string, roles: ClassTeacherRole[] = allTeacherClassRoles) {
    const profile = await this.prisma.teacherProfile.findFirst({
      where: { userId, status: "ACTIVE", deletedAt: null },
      include: { user: true }
    });
    if (!profile) throw new NotFoundException("Không tìm thấy hồ sơ giảng viên đang hoạt động");
    const classes = await this.prisma.learningClass.findMany({
      where: teacherClassAccess(userId, roles),
      include: {
        enrollments: {
          where: { status: "ACTIVE", deletedAt: null },
          include: { student: { include: { user: true } }, course: true }
        }
      },
      orderBy: { createdAt: "asc" }
    });
    if (!classes[0]) throw new NotFoundException("Không tìm thấy lớp đang hoạt động của giảng viên");
    const classPriority = (value: Prisma.JsonValue): number => {
      const metadata = objectJson(value);
      if (metadata.primaryDemoClass === true) return 2;
      if (typeof metadata.fixture === "string" && metadata.fixture.length > 0) return 1;
      return 0;
    };
    const prioritizedClasses = [...classes].sort(
      (left, right) => classPriority(right.metadataJson) - classPriority(left.metadataJson)
    );
    return { ...profile, classes: prioritizedClasses };
  }

  private async ownedClass(
    id: string,
    teacherUserId: string,
    roles: ClassTeacherRole[] = learnerDataRoles
  ) {
    const row = await this.prisma.learningClass.findFirst({
      where: {
        AND: [
          { OR: [{ id }, { code: id }] },
          teacherClassAccess(teacherUserId, roles)
        ]
      },
      include: {
        enrollments: {
          where: { status: "ACTIVE", deletedAt: null },
          include: { student: { include: { user: true } }, course: true }
        }
      }
    });
    if (!row) throw new NotFoundException("Class not found");
    return row;
  }

  private async ownedStudent(id: string, teacherUserId: string) {
    const profile = await this.prisma.studentProfile.findFirst({
      where: {
        OR: [{ id }, { userId: id }],
        enrollments: {
          some: {
            status: "ACTIVE",
            deletedAt: null,
            class: teacherClassAccess(teacherUserId, learnerDataRoles)
          }
        },
        status: "ACTIVE",
        deletedAt: null
      },
      include: {
        user: true,
        enrollments: {
          where: {
            status: "ACTIVE",
            deletedAt: null,
            class: teacherClassAccess(teacherUserId, learnerDataRoles)
          },
          include: { course: true }
        }
      }
    });
    if (!profile) throw new NotFoundException("Student not found");
    return profile;
  }
}
