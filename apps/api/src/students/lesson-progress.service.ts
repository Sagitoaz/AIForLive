import { ForbiddenException, Injectable } from "@nestjs/common";
import { LessonPhase, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

type ProgressStatus = "COMPLETED" | "CURRENT" | "AVAILABLE" | "LOCKED";

export interface ProgressLessonDefinition {
  id: string;
  moduleId: string;
  moduleOrder: number;
  order: number;
  resources: Array<{ id: string; phase: LessonPhase }>;
  exercises: Array<{ id: string; phase: LessonPhase }>;
}

export interface PhaseProgress {
  phase: LessonPhase;
  status: ProgressStatus;
  completedActivities: number;
  attemptedActivities: number;
  totalActivities: number;
  progress: number;
  completedActivityIds: string[];
  attemptedActivityIds: string[];
  lastActivityAt: string | null;
}

export interface LessonProgress {
  lessonId: string;
  moduleId: string;
  status: ProgressStatus;
  progress: number;
  phases: PhaseProgress[];
}

export interface CourseProgressSnapshot {
  courseId: string;
  storedEnrollmentProgress: number;
  inferredCompletedLessons: number;
  progress: number;
  completedLessons: number;
  totalLessons: number;
  courseCompleted: boolean;
  currentLocation: {
    moduleId: string;
    lessonId: string;
    phase: LessonPhase;
    activityId: string | null;
    progress: number;
    reason: string;
  } | null;
  lessons: LessonProgress[];
}

interface ActivityBucket {
  attempted: Set<string>;
  completed: Set<string>;
  lastActivityAt: Date | null;
}

const phases = [LessonPhase.THEORY, LessonPhase.PRACTICE, LessonPhase.CHECKPOINT] as const;

function objectJson(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  return value && !Array.isArray(value) && typeof value === "object"
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function key(lessonId: string, phase: LessonPhase): string {
  return `${lessonId}:${phase}`;
}

function bucket(map: Map<string, ActivityBucket>, lessonId: string, phase: LessonPhase): ActivityBucket {
  const bucketKey = key(lessonId, phase);
  const existing = map.get(bucketKey);
  if (existing) return existing;
  const created = { attempted: new Set<string>(), completed: new Set<string>(), lastActivityAt: null };
  map.set(bucketKey, created);
  return created;
}

@Injectable()
export class LessonProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(
    userId: string,
    courseId: string,
    suppliedLessons?: ProgressLessonDefinition[]
  ): Promise<CourseProgressSnapshot> {
    const lessonsPromise = suppliedLessons
      ? Promise.resolve(suppliedLessons)
      : this.prisma.lesson.findMany({
          where: { module: { courseId }, status: "ACTIVE", deletedAt: null },
          select: {
            id: true,
            moduleId: true,
            order: true,
            module: { select: { order: true } },
            resources: {
              where: { status: "ACTIVE", deletedAt: null },
              select: { id: true, phase: true }
            },
            exercises: {
              where: { status: "ACTIVE", deletedAt: null },
              select: { id: true, phase: true }
            }
          },
          orderBy: [{ module: { order: "asc" } }, { order: "asc" }]
        }).then((rows) => rows.map((row) => ({
          id: row.id,
          moduleId: row.moduleId,
          moduleOrder: row.module.order,
          order: row.order,
          resources: row.resources,
          exercises: row.exercises
        })));

    const [lessons, enrollment, attempts, events] = await Promise.all([
      lessonsPromise,
      this.prisma.enrollment.findFirst({
        where: {
          courseId,
          status: "ACTIVE",
          deletedAt: null,
          student: { userId, status: "ACTIVE", deletedAt: null }
        },
        select: { progress: true }
      }),
      this.prisma.attempt.findMany({
        where: { userId, exercise: { lesson: { module: { courseId } } } },
        select: {
          exerciseId: true,
          isCorrect: true,
          createdAt: true,
          exercise: { select: { lessonId: true, phase: true } }
        }
      }),
      this.prisma.learningEvent.findMany({
        where: { userId, courseId },
        select: { type: true, occurredAt: true, payloadJson: true }
      })
    ]);

    if (!enrollment) throw new ForbiddenException("Học sinh chưa được ghi danh vào khóa học này");

    const orderedLessons = [...lessons].sort(
      (left, right) => left.moduleOrder - right.moduleOrder || left.order - right.order
    );
    const activity = new Map<string, ActivityBucket>();
    for (const attempt of attempts) {
      const target = bucket(activity, attempt.exercise.lessonId, attempt.exercise.phase);
      target.attempted.add(attempt.exerciseId);
      if (attempt.isCorrect) target.completed.add(attempt.exerciseId);
      if (!target.lastActivityAt || attempt.createdAt > target.lastActivityAt) target.lastActivityAt = attempt.createdAt;
    }

    const explicitCompletions = new Set<string>();
    for (const event of events) {
      const payload = objectJson(event.payloadJson);
      const lessonId = typeof payload.lessonId === "string" ? payload.lessonId : null;
      const phaseValue = typeof payload.lessonPhase === "string" ? payload.lessonPhase : payload.phase;
      const phase = Object.values(LessonPhase).includes(phaseValue as LessonPhase)
        ? (phaseValue as LessonPhase)
        : null;
      const completed = payload.completed === true || payload.status === "COMPLETED";
      if (!lessonId || !phase || !completed) continue;
      explicitCompletions.add(key(lessonId, phase));
      const target = bucket(activity, lessonId, phase);
      if (!target.lastActivityAt || event.occurredAt > target.lastActivityAt) target.lastActivityAt = event.occurredAt;
    }

    const furthestEvidenceIndex = orderedLessons.reduce((furthest, lesson, index) => {
      const hasActivity = phases.some((phase) => {
        const value = activity.get(key(lesson.id, phase));
        return Boolean(value && (value.attempted.size || value.completed.size || value.lastActivityAt));
      });
      return hasActivity ? index : furthest;
    }, -1);
    const storedCompletedLessons = Math.min(
      orderedLessons.length,
      Math.max(0, Math.floor(enrollment.progress * orderedLessons.length))
    );
    // Dữ liệu pilot cũ chỉ lưu progress tổng. Khi đã có bằng chứng ở một bài xa hơn,
    // coi các bài tuyến tính trước đó là đã qua để không đưa học sinh quay về bài 1.
    const inferredCompletedLessons = Math.max(
      storedCompletedLessons,
      furthestEvidenceIndex > 0 ? furthestEvidenceIndex : 0
    );

    const raw = orderedLessons.map((lesson, lessonIndex) => {
      const practiceActivity = bucket(activity, lesson.id, LessonPhase.PRACTICE);
      const checkpointActivity = bucket(activity, lesson.id, LessonPhase.CHECKPOINT);
      const phaseRows = phases.map((phase): Omit<PhaseProgress, "status"> & { completed: boolean } => {
        const target = bucket(activity, lesson.id, phase);
        const itemIds = phase === LessonPhase.THEORY
          ? lesson.resources.filter((item) => item.phase === phase).map((item) => item.id)
          : lesson.exercises.filter((item) => item.phase === phase).map((item) => item.id);
        const explicit = explicitCompletions.has(key(lesson.id, phase));
        const inferredTheoryCompletion = phase === LessonPhase.THEORY
          && (practiceActivity.attempted.size > 0 || checkpointActivity.attempted.size > 0);
        const minimumCheckpointCorrect = Math.max(1, Math.ceil(itemIds.length * 0.67));
        const completed = itemIds.length === 0
          || explicit
          || inferredTheoryCompletion
          || (phase === LessonPhase.CHECKPOINT
            ? target.completed.size >= minimumCheckpointCorrect
            : target.completed.size >= itemIds.length);
        const completedActivities = completed && phase === LessonPhase.THEORY
          ? itemIds.length
          : itemIds.filter((id) => target.completed.has(id)).length;
        const attemptedActivities = explicit && phase === LessonPhase.THEORY
          ? itemIds.length
          : itemIds.filter((id) => target.attempted.has(id)).length;
        return {
          phase,
          completed,
          completedActivities,
          attemptedActivities,
          totalActivities: itemIds.length,
          progress: itemIds.length ? clamp(completedActivities / itemIds.length) : 1,
          completedActivityIds: [...target.completed],
          attemptedActivityIds: [...target.attempted],
          lastActivityAt: target.lastActivityAt?.toISOString() ?? null
        };
      });
      if (lessonIndex < inferredCompletedLessons) {
        const inferredPhases = phaseRows.map((phase) => ({
          ...phase,
          completed: true,
          completedActivities: phase.totalActivities,
          progress: 1
        }));
        return { lesson, phases: inferredPhases, completed: true };
      }
      return { lesson, phases: phaseRows, completed: phaseRows.every((phase) => phase.completed) };
    });

    const currentLessonIndex = raw.findIndex((item) => !item.completed);
    const lessonProgress = raw.map((item, lessonIndex): LessonProgress => {
      const status: ProgressStatus = item.completed
        ? "COMPLETED"
        : lessonIndex === currentLessonIndex
          ? "CURRENT"
          : lessonIndex > currentLessonIndex && currentLessonIndex >= 0
            ? "LOCKED"
            : "AVAILABLE";
      let currentPhaseAssigned = false;
      const phaseProgress = item.phases.map((phase): PhaseProgress => {
        let phaseStatus: ProgressStatus;
        if (phase.completed) phaseStatus = "COMPLETED";
        else if (status === "CURRENT" && !currentPhaseAssigned) {
          phaseStatus = "CURRENT";
          currentPhaseAssigned = true;
        } else if (status === "CURRENT" || status === "LOCKED") phaseStatus = "LOCKED";
        else phaseStatus = "AVAILABLE";
        return {
          phase: phase.phase,
          status: phaseStatus,
          completedActivities: phase.completedActivities,
          attemptedActivities: phase.attemptedActivities,
          totalActivities: phase.totalActivities,
          progress: phase.progress,
          completedActivityIds: phase.completedActivityIds,
          attemptedActivityIds: phase.attemptedActivityIds,
          lastActivityAt: phase.lastActivityAt
        };
      });
      return {
        lessonId: item.lesson.id,
        moduleId: item.lesson.moduleId,
        status,
        progress: phaseProgress.reduce((sum, phase) => sum + phase.progress, 0) / phases.length,
        phases: phaseProgress
      };
    });

    const currentLesson = currentLessonIndex >= 0 ? orderedLessons[currentLessonIndex] : undefined;
    const currentProgress = currentLesson
      ? lessonProgress.find((item) => item.lessonId === currentLesson.id)
      : undefined;
    const currentPhase = currentProgress?.phases.find((phase) => phase.status === "CURRENT");
    const sourceItems = currentLesson && currentPhase
      ? currentPhase.phase === LessonPhase.THEORY
        ? currentLesson.resources.filter((item) => item.phase === currentPhase.phase)
        : currentLesson.exercises.filter((item) => item.phase === currentPhase.phase)
      : [];
    const activityId = sourceItems.find((item) => !currentPhase?.completedActivityIds.includes(item.id))?.id
      ?? sourceItems[0]?.id
      ?? null;
    const completedLessons = lessonProgress.filter((item) => item.status === "COMPLETED").length;
    const overallProgress = lessonProgress.length
      ? lessonProgress.reduce((sum, item) => sum + item.progress, 0) / lessonProgress.length
      : enrollment.progress;

    return {
      courseId,
      storedEnrollmentProgress: enrollment.progress,
      inferredCompletedLessons,
      progress: Number(clamp(overallProgress).toFixed(4)),
      completedLessons,
      totalLessons: lessonProgress.length,
      courseCompleted: lessonProgress.length > 0 && completedLessons === lessonProgress.length,
      currentLocation: currentLesson && currentPhase
        ? {
            moduleId: currentLesson.moduleId,
            lessonId: currentLesson.id,
            phase: currentPhase.phase,
            activityId,
            progress: currentPhase.progress,
            reason: this.locationReason(currentPhase.phase)
          }
        : null,
      lessons: lessonProgress
    };
  }

  private locationReason(phase: LessonPhase): string {
    if (phase === LessonPhase.THEORY) return "Hoàn thành bài giảng và tài liệu trước khi thực hành";
    if (phase === LessonPhase.PRACTICE) return "Luyện tập đến khi làm đúng các hoạt động cốt lõi";
    return "Đạt tối thiểu 67% câu kiểm tra để hoàn thành bài";
  }
}
