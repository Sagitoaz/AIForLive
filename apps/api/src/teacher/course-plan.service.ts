import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, ClassTeacherRole, ContentStatus, LessonPhase, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import type {
  CoursePlanActionDto,
  EditCoursePlanDto,
  GenerateCoursePlanDto
} from "./dto/course-plan.dto";

const catalogInclude = Prisma.validator<Prisma.CourseInclude>()({
  domain: true,
  organization: true,
  modules: {
    where: { status: "ACTIVE", deletedAt: null },
    orderBy: { order: "asc" },
    include: {
      lessons: {
        where: { status: "ACTIVE", deletedAt: null },
        orderBy: { order: "asc" },
        include: {
          concept: {
            include: {
              dependsOn: { include: { prerequisite: true } }
            }
          },
          resources: {
            where: { status: "ACTIVE", deletedAt: null },
            orderBy: { createdAt: "asc" }
          },
          exercises: {
            where: { status: "ACTIVE", deletedAt: null },
            orderBy: { createdAt: "asc" }
          }
        }
      }
    }
  }
});

const planInclude = Prisma.validator<Prisma.CoursePlanDraftInclude>()({
  course: { select: { id: true, code: true, title: true, version: true } },
  learningClass: { select: { id: true, code: true, name: true } },
  requestedBy: { select: { id: true, displayName: true } }
});

type Catalog = Prisma.CourseGetPayload<{ include: typeof catalogInclude }>;
type CoursePlanRow = Prisma.CoursePlanDraftGetPayload<{ include: typeof planInclude }>;
type CatalogLesson = Catalog["modules"][number]["lessons"][number];

interface Candidate {
  lesson: CatalogLesson;
  moduleId: string;
  moduleTitle: string;
  moduleOrder: number;
  lessonOrder: number;
  score: number;
  matchedTerms: string[];
  hasThreePhases: boolean;
  prerequisiteConceptIds: string[];
}

interface ReviewEntry {
  action: string;
  from: ContentStatus;
  to: ContentStatus;
  actorId: string;
  at: string;
  comment?: string;
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function objectJson(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  return value && !Array.isArray(value) && typeof value === "object"
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

const allTeacherRoles: ClassTeacherRole[] = [
  ClassTeacherRole.OWNER,
  ClassTeacherRole.INSTRUCTOR,
  ClassTeacherRole.REVIEWER
];
const planAuthorRoles: ClassTeacherRole[] = [ClassTeacherRole.OWNER, ClassTeacherRole.INSTRUCTOR];
const planReviewerRoles: ClassTeacherRole[] = [ClassTeacherRole.OWNER, ClassTeacherRole.REVIEWER];

function teacherClassAccess(
  userId: string,
  roles: ClassTeacherRole[] = allTeacherRoles
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

function teacherCourseAccess(
  userId: string,
  roles: ClassTeacherRole[] = allTeacherRoles
): Prisma.CourseWhereInput {
  return {
    status: "ACTIVE",
    deletedAt: null,
    organization: { status: "ACTIVE", deletedAt: null },
    enrollments: {
      some: {
        status: "ACTIVE",
        deletedAt: null,
        class: teacherClassAccess(userId, roles)
      }
    }
  };
}

function stringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function reviewEntries(value: Prisma.JsonValue): ReviewEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || Array.isArray(item) || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.action !== "string"
      || typeof entry.from !== "string"
      || typeof entry.to !== "string"
      || typeof entry.actorId !== "string"
      || typeof entry.at !== "string"
    ) return [];
    return [{
      action: entry.action,
      from: entry.from as ContentStatus,
      to: entry.to as ContentStatus,
      actorId: entry.actorId,
      at: entry.at,
      ...(typeof entry.comment === "string" ? { comment: entry.comment } : {})
    }];
  });
}

function cleanGoals(goals: string[]): string[] {
  return [...new Set(goals.map((goal) => goal.trim()).filter(Boolean))];
}

const ignoredTerms = new Set([
  "cho", "cac", "cua", "duoc", "hoc", "hieu", "lop", "mot", "nhung", "sinh", "the", "tieu", "va", "voi"
]);

function tokens(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3 && !ignoredTerms.has(term));
}

@Injectable()
export class CoursePlanService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(input: GenerateCoursePlanDto, teacherUserId: string): Promise<Record<string, unknown>> {
    const startedAt = performance.now();
    const [catalog, learningClass] = await Promise.all([
      this.catalog(input.courseId, teacherUserId),
      input.classId ? this.ownedClass(input.classId, teacherUserId) : Promise.resolve(null)
    ]);
    if (learningClass && learningClass.organizationId !== catalog.organizationId) {
      throw new BadRequestException("Lớp và khóa học phải thuộc cùng một tổ chức");
    }
    const goals = cleanGoals(input.goals);
    if (!goals.length) throw new BadRequestException("Cần ít nhất một mục tiêu học tập");
    const className = learningClass?.name ?? input.className?.trim() ?? null;
    const draftInput = {
      courseId: catalog.id,
      classId: learningClass?.id ?? null,
      className,
      gradeBand: input.gradeBand.trim(),
      goals,
      durationWeeks: input.durationWeeks
    };
    const plan = this.buildPlan(catalog, draftInput);
    const generationMs = Math.max(1, Math.round(performance.now() - startedAt));
    const title = input.title?.trim() || `Lộ trình ${catalog.title} · ${input.durationWeeks} tuần`;
    const catalogSnapshot = this.catalogSnapshot(catalog);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.coursePlanDraft.create({
        data: {
          courseId: catalog.id,
          classId: learningClass?.id,
          requestedById: teacherUserId,
          title,
          gradeBand: draftInput.gradeBand,
          goalsJson: json(goals),
          durationWeeks: input.durationWeeks,
          status: ContentStatus.DRAFT,
          inputJson: json(draftInput),
          catalogSnapshotJson: json(catalogSnapshot),
          aiDraftJson: json(plan),
          planJson: json(plan),
          metadataJson: json({
            className,
            generationMs,
            humanReviewRequired: true,
            generatedFromExistingCatalog: true
          })
        },
        include: planInclude
      });
      await tx.auditLog.create({
        data: {
          actorId: teacherUserId,
          action: AuditAction.CREATE,
          entityType: "CoursePlanDraft",
          entityId: created.id,
          correlationId: randomUUID(),
          afterJson: json({ status: created.status, courseId: catalog.id, selectedLessonIds: plan.explainability.selectedLessonIds })
        }
      });
      return created;
    });
    return this.toDto(row);
  }

  async list(teacherUserId: string): Promise<Record<string, unknown>[]> {
    const rows = await this.prisma.coursePlanDraft.findMany({
      where: { course: teacherCourseAccess(teacherUserId) },
      include: planInclude,
      orderBy: { updatedAt: "desc" }
    });
    return rows.map((row) => this.toDto(row));
  }

  async get(id: string, teacherUserId: string): Promise<Record<string, unknown>> {
    return this.toDto(await this.row(id, teacherUserId));
  }

  async edit(id: string, input: EditCoursePlanDto, teacherUserId: string): Promise<Record<string, unknown>> {
    const existing = await this.row(id, teacherUserId, planAuthorRoles);
    const immutableStatuses: ContentStatus[] = [ContentStatus.PUBLISHED, ContentStatus.REJECTED, ContentStatus.ARCHIVED];
    if (immutableStatuses.includes(existing.status)) {
      throw new BadRequestException("Lộ trình ở trạng thái này không thể chỉnh sửa; hãy tạo một bản nháp mới");
    }
    const goals = input.goals ? cleanGoals(input.goals) : stringArray(existing.goalsJson);
    if (!goals.length) throw new BadRequestException("Cần ít nhất một mục tiêu học tập");
    const gradeBand = input.gradeBand?.trim() || existing.gradeBand;
    const durationWeeks = input.durationWeeks ?? existing.durationWeeks;
    const shouldRegenerate = input.goals !== undefined || input.gradeBand !== undefined || input.durationWeeks !== undefined;
    const needsCatalog = shouldRegenerate || input.planJson !== undefined;
    const catalog = needsCatalog ? await this.catalog(existing.courseId, teacherUserId) : null;
    let nextPlan: Record<string, unknown> = objectJson(existing.planJson) as Record<string, unknown>;
    let nextCatalogSnapshot = existing.catalogSnapshotJson as Prisma.InputJsonValue;
    if (shouldRegenerate && catalog) {
      const metadata = objectJson(existing.metadataJson);
      nextPlan = this.buildPlan(catalog, {
        courseId: existing.courseId,
        classId: existing.classId,
        className: typeof metadata.className === "string" ? metadata.className : existing.learningClass?.name ?? null,
        gradeBand,
        goals,
        durationWeeks
      });
      nextCatalogSnapshot = json(this.catalogSnapshot(catalog));
    }
    if (input.planJson && catalog) nextPlan = this.normalizeTeacherPlan(input.planJson, catalog);
    const reviewStatuses: ContentStatus[] = [ContentStatus.IN_REVIEW, ContentStatus.APPROVED];
    const nextStatus = reviewStatuses.includes(existing.status)
      ? ContentStatus.REVISION_REQUIRED
      : existing.status;
    const nextVersion = existing.version + 1;
    const history = this.appendHistory(existing, "EDIT", nextStatus, teacherUserId,
      nextStatus !== existing.status ? "Nội dung thay đổi nên cần được duyệt lại" : undefined);
    const currentInput = objectJson(existing.inputJson);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.coursePlanDraft.update({
        where: { id: existing.id },
        data: {
          title: input.title?.trim() || existing.title,
          gradeBand,
          goalsJson: json(goals),
          durationWeeks,
          status: nextStatus,
          version: nextVersion,
          inputJson: json({ ...currentInput, gradeBand, goals, durationWeeks }),
          catalogSnapshotJson: nextCatalogSnapshot,
          planJson: json(nextPlan),
          reviewHistoryJson: json(history),
          teacherEditingSeconds: { increment: input.teacherEditingSeconds ?? 0 },
          metadataJson: json({ ...objectJson(existing.metadataJson), lastEditedById: teacherUserId }),
          ...(nextStatus === ContentStatus.REVISION_REQUIRED ? { approvedAt: null, publishedAt: null } : {})
        },
        include: planInclude
      });
      await tx.auditLog.create({
        data: {
          actorId: teacherUserId,
          action: AuditAction.UPDATE,
          entityType: "CoursePlanDraft",
          entityId: id,
          correlationId: randomUUID(),
          beforeJson: json({ status: existing.status, version: existing.version }),
          afterJson: json({ status: nextStatus, version: nextVersion })
        }
      });
      return row;
    });
    return this.toDto(updated);
  }

  submitReview(id: string, input: CoursePlanActionDto, teacherUserId: string): Promise<Record<string, unknown>> {
    return this.transition(id, "SUBMIT_REVIEW", ContentStatus.IN_REVIEW,
      [ContentStatus.DRAFT, ContentStatus.REVISION_REQUIRED], input.comment, teacherUserId);
  }

  approve(id: string, input: CoursePlanActionDto, teacherUserId: string): Promise<Record<string, unknown>> {
    return this.transition(id, "APPROVE", ContentStatus.APPROVED,
      [ContentStatus.IN_REVIEW], input.comment, teacherUserId);
  }

  requestRevision(id: string, input: CoursePlanActionDto, teacherUserId: string): Promise<Record<string, unknown>> {
    return this.transition(id, "REQUEST_REVISION", ContentStatus.REVISION_REQUIRED,
      [ContentStatus.IN_REVIEW, ContentStatus.APPROVED], input.comment, teacherUserId);
  }

  publish(id: string, input: CoursePlanActionDto, teacherUserId: string): Promise<Record<string, unknown>> {
    return this.transition(id, "PUBLISH", ContentStatus.PUBLISHED,
      [ContentStatus.APPROVED], input.comment, teacherUserId);
  }

  private async transition(
    id: string,
    action: string,
    to: ContentStatus,
    allowed: ContentStatus[],
    comment: string | undefined,
    teacherUserId: string
  ): Promise<Record<string, unknown>> {
    const reviewAction = action !== "SUBMIT_REVIEW";
    const existing = await this.row(
      id,
      teacherUserId,
      reviewAction ? planReviewerRoles : planAuthorRoles
    );
    const existingMetadata = objectJson(existing.metadataJson);
    const lastEditedById = typeof existingMetadata.lastEditedById === "string"
      ? existingMetadata.lastEditedById
      : null;
    if (reviewAction && (existing.requestedById === teacherUserId || lastEditedById === teacherUserId)) {
      throw new BadRequestException("Người tạo bản nháp không thể tự duyệt hoặc xuất bản lộ trình của mình");
    }
    if (!allowed.includes(existing.status)) {
      throw new BadRequestException(`Không thể ${action} lộ trình từ trạng thái ${existing.status}`);
    }
    const now = new Date();
    const nextVersion = existing.version + 1;
    const history = this.appendHistory(existing, action, to, teacherUserId, comment);
    const auditAction = action === "APPROVE"
      ? AuditAction.APPROVE
      : action === "PUBLISH"
        ? AuditAction.PUBLISH
        : AuditAction.UPDATE;
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.coursePlanDraft.update({
        where: { id: existing.id },
        data: {
          status: to,
          version: nextVersion,
          reviewHistoryJson: json(history),
          ...(action === "SUBMIT_REVIEW" ? { submittedAt: now } : {}),
          ...(action === "APPROVE" ? { approvedAt: now } : {}),
          ...(action === "REQUEST_REVISION" ? { approvedAt: null, publishedAt: null } : {}),
          ...(action === "PUBLISH" ? { publishedAt: now } : {})
        },
        include: planInclude
      });
      await tx.auditLog.create({
        data: {
          actorId: teacherUserId,
          action: auditAction,
          entityType: "CoursePlanDraft",
          entityId: id,
          correlationId: randomUUID(),
          beforeJson: json({ status: existing.status, version: existing.version }),
          afterJson: json({ status: to, version: nextVersion, comment })
        }
      });
      return row;
    });
    return this.toDto(updated);
  }

  private async catalog(
    courseIdOrCode: string,
    teacherUserId: string,
    roles: ClassTeacherRole[] = planAuthorRoles
  ): Promise<Catalog> {
    const course = await this.prisma.course.findFirst({
      where: {
        OR: [{ id: courseIdOrCode }, { code: courseIdOrCode }],
        ...teacherCourseAccess(teacherUserId, roles)
      },
      include: catalogInclude
    });
    if (!course) throw new NotFoundException("Không tìm thấy khóa học mà giáo viên có quyền lập kế hoạch");
    if (!course.modules.some((module) => module.lessons.length > 0)) {
      throw new BadRequestException("Khóa học chưa có bài học hoạt động để tạo lộ trình");
    }
    return course;
  }

  private async ownedClass(
    classIdOrCode: string,
    teacherUserId: string,
    roles: ClassTeacherRole[] = planAuthorRoles
  ) {
    const row = await this.prisma.learningClass.findFirst({
      where: {
        OR: [{ id: classIdOrCode }, { code: classIdOrCode }],
        AND: [teacherClassAccess(teacherUserId, roles)]
      }
    });
    if (!row) throw new NotFoundException("Không tìm thấy lớp học của giáo viên");
    return row;
  }

  private async row(
    id: string,
    teacherUserId: string,
    roles: ClassTeacherRole[] = allTeacherRoles
  ): Promise<CoursePlanRow> {
    const row = await this.prisma.coursePlanDraft.findFirst({
      where: { id, course: teacherCourseAccess(teacherUserId, roles) },
      include: planInclude
    });
    if (!row) throw new NotFoundException("Không tìm thấy bản nháp lộ trình");
    return row;
  }

  private buildPlan(
    catalog: Catalog,
    input: {
      courseId: string;
      classId: string | null;
      className: string | null;
      gradeBand: string;
      goals: string[];
      durationWeeks: number;
    }
  ) {
    const goalTerms = new Set(tokens(`${input.gradeBand} ${input.goals.join(" ")}`));
    const candidates: Candidate[] = catalog.modules.flatMap((module) => module.lessons.map((lesson) => {
      const searchable = `${module.title} ${lesson.title} ${lesson.summary} ${lesson.concept.code} ${lesson.concept.title} ${lesson.concept.description}`;
      const matchedTerms = [...new Set(tokens(searchable).filter((term) => goalTerms.has(term)))];
      const phases = new Set<LessonPhase>([
        ...lesson.resources.map((resource) => resource.phase),
        ...lesson.exercises.map((exercise) => exercise.phase)
      ]);
      const hasThreePhases = [LessonPhase.THEORY, LessonPhase.PRACTICE, LessonPhase.CHECKPOINT]
        .every((phase) => phases.has(phase));
      const score = Number(Math.min(1,
        0.25
        + Math.min(0.5, matchedTerms.length * 0.1)
        + (hasThreePhases ? 0.15 : 0)
        + (module.order === 1 && lesson.order === 1 ? 0.1 : 0)
      ).toFixed(3));
      return {
        lesson,
        moduleId: module.id,
        moduleTitle: module.title,
        moduleOrder: module.order,
        lessonOrder: lesson.order,
        score,
        matchedTerms,
        hasThreePhases,
        prerequisiteConceptIds: lesson.concept.dependsOn.map((item) => item.prerequisiteConceptId)
      };
    }));
    const targetLessonCount = Math.min(candidates.length, Math.max(1, input.durationWeeks * 2));
    const selected = new Map<string, Candidate>();
    const selectionReasons = new Map<string, string[]>();
    const byConceptId = new Map(candidates.map((candidate) => [candidate.lesson.conceptId, candidate]));
    const addWithPrerequisites = (candidate: Candidate, reason: string, visiting = new Set<string>()): void => {
      if (visiting.has(candidate.lesson.id)) return;
      visiting.add(candidate.lesson.id);
      for (const prerequisiteConceptId of candidate.prerequisiteConceptIds) {
        const prerequisite = byConceptId.get(prerequisiteConceptId);
        if (prerequisite) addWithPrerequisites(prerequisite, `Kiến thức nền cho bài “${candidate.lesson.title}”`, visiting);
      }
      selected.set(candidate.lesson.id, candidate);
      selectionReasons.set(candidate.lesson.id, [...new Set([...(selectionReasons.get(candidate.lesson.id) ?? []), reason])]);
    };
    const orderedByRelevance = [...candidates].sort((left, right) =>
      right.score - left.score || left.moduleOrder - right.moduleOrder || left.lessonOrder - right.lessonOrder
    );
    if (candidates[0]) addWithPrerequisites(candidates[0], "Bài nền tảng mở đầu của khóa học");
    for (const candidate of orderedByRelevance) {
      if (selected.size >= targetLessonCount) break;
      addWithPrerequisites(candidate,
        candidate.matchedTerms.length
          ? `Khớp mục tiêu qua từ khóa: ${candidate.matchedTerms.join(", ")}`
          : "Bổ sung để bảo đảm tiến trình kiến thức liên tục");
    }
    const selectedLessons = [...selected.values()].sort((left, right) =>
      left.moduleOrder - right.moduleOrder || left.lessonOrder - right.lessonOrder
    );
    const lessonDtos = selectedLessons.map((candidate) => {
      const phase = (phaseName: LessonPhase) => {
        const resourceIds = candidate.lesson.resources.filter((item) => item.phase === phaseName).map((item) => item.id);
        const exerciseIds = candidate.lesson.exercises.filter((item) => item.phase === phaseName).map((item) => item.id);
        return { resourceIds, exerciseIds, activityCount: resourceIds.length + exerciseIds.length };
      };
      const reasons = [...(selectionReasons.get(candidate.lesson.id) ?? [])];
      if (candidate.hasThreePhases) reasons.push("Có đủ hoạt động lý thuyết, thực hành và kiểm tra cuối bài");
      return {
        lessonId: candidate.lesson.id,
        moduleId: candidate.moduleId,
        moduleTitle: candidate.moduleTitle,
        conceptId: candidate.lesson.conceptId,
        conceptCode: candidate.lesson.concept.code,
        title: candidate.lesson.title,
        estimatedMinutes: candidate.lesson.durationMinutes,
        selectionScore: candidate.score,
        reasons: [...new Set(reasons)],
        phases: {
          THEORY: phase(LessonPhase.THEORY),
          PRACTICE: phase(LessonPhase.PRACTICE),
          CHECKPOINT: phase(LessonPhase.CHECKPOINT)
        }
      };
    });
    const weeks = Array.from({ length: input.durationWeeks }, (_, index) => ({
      week: index + 1,
      title: `Tuần ${index + 1}`,
      focus: "Ôn tập, củng cố và hoàn thiện phần còn thiếu",
      estimatedMinutes: 0,
      lessons: [] as typeof lessonDtos
    }));
    for (const [lessonIndex, lesson] of lessonDtos.entries()) {
      // Giữ nguyên thứ tự prerequisite/module; chỉ chia tuần theo các đoạn liên tiếp.
      const targetIndex = Math.min(
        weeks.length - 1,
        Math.floor((lessonIndex * weeks.length) / Math.max(1, lessonDtos.length))
      );
      const target = weeks[targetIndex]!;
      target.lessons.push(lesson);
      target.estimatedMinutes += lesson.estimatedMinutes;
      target.focus = target.lessons.map((item) => item.title).join(" · ");
    }
    const candidateLog = candidates.map((candidate) => ({
      lessonId: candidate.lesson.id,
      conceptId: candidate.lesson.conceptId,
      score: candidate.score,
      selected: selected.has(candidate.lesson.id),
      matchedTerms: candidate.matchedTerms,
      reasons: selectionReasons.get(candidate.lesson.id) ?? ["Không nằm trong dung lượng của kế hoạch pilot"]
    }));
    return {
      schemaVersion: "course-plan-v1",
      locale: "vi-VN",
      audience: { classId: input.classId, className: input.className, gradeBand: input.gradeBand },
      goals: input.goals,
      durationWeeks: input.durationWeeks,
      estimatedMinutes: lessonDtos.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0),
      weeks,
      explainability: {
        modelVersion: "course-plan-v1",
        provider: "LOCAL_CATALOG_PLANNER",
        humanReviewRequired: true,
        catalogCourseId: catalog.id,
        catalogVersion: catalog.version,
        candidateCount: candidates.length,
        selectedLessonIds: lessonDtos.map((lesson) => lesson.lessonId),
        selectionFactors: ["Mức khớp mục tiêu", "Quan hệ kiến thức tiên quyết", "Thứ tự mô-đun", "Độ phủ ba pha học"],
        candidateLog
      }
    };
  }

  private normalizeTeacherPlan(input: Record<string, unknown>, catalog: Catalog): Record<string, unknown> {
    const cloned = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
    if (!Array.isArray(cloned.weeks) || !cloned.weeks.length) {
      throw new BadRequestException("planJson phải có ít nhất một tuần");
    }
    const validLessonIds = new Set(catalog.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)));
    const selectedLessonIds: string[] = [];
    for (const [weekIndex, rawWeek] of cloned.weeks.entries()) {
      if (!rawWeek || typeof rawWeek !== "object" || Array.isArray(rawWeek)) {
        throw new BadRequestException(`Tuần ${weekIndex + 1} trong planJson không hợp lệ`);
      }
      const week = rawWeek as Record<string, unknown>;
      if (!Array.isArray(week.lessons)) throw new BadRequestException(`Tuần ${weekIndex + 1} phải có mảng lessons`);
      for (const rawLesson of week.lessons) {
        if (!rawLesson || typeof rawLesson !== "object" || Array.isArray(rawLesson)) {
          throw new BadRequestException(`Bài học trong tuần ${weekIndex + 1} không hợp lệ`);
        }
        const lessonId = (rawLesson as Record<string, unknown>).lessonId;
        if (typeof lessonId !== "string" || !validLessonIds.has(lessonId)) {
          throw new BadRequestException(`Bài học ${String(lessonId)} không thuộc catalog hiện tại`);
        }
        selectedLessonIds.push(lessonId);
      }
    }
    const explainability = cloned.explainability && typeof cloned.explainability === "object" && !Array.isArray(cloned.explainability)
      ? cloned.explainability as Record<string, unknown>
      : {};
    cloned.schemaVersion = "course-plan-v1";
    cloned.explainability = {
      ...explainability,
      modelVersion: "course-plan-v1",
      provider: "LOCAL_CATALOG_PLANNER",
      humanReviewRequired: true,
      catalogCourseId: catalog.id,
      catalogVersion: catalog.version,
      selectedLessonIds: [...new Set(selectedLessonIds)],
      teacherEdited: true
    };
    return cloned;
  }

  private catalogSnapshot(catalog: Catalog) {
    return {
      course: { id: catalog.id, code: catalog.code, title: catalog.title, version: catalog.version },
      capturedAt: new Date().toISOString(),
      lessons: catalog.modules.flatMap((module) => module.lessons.map((lesson) => ({
        lessonId: lesson.id,
        version: lesson.version,
        moduleId: module.id,
        moduleOrder: module.order,
        lessonOrder: lesson.order,
        conceptId: lesson.conceptId,
        resourceIds: lesson.resources.map((item) => item.id),
        exerciseIds: lesson.exercises.map((item) => item.id)
      })))
    };
  }

  private appendHistory(
    row: CoursePlanRow,
    action: string,
    to: ContentStatus,
    actorId: string,
    comment?: string
  ): ReviewEntry[] {
    return [
      ...reviewEntries(row.reviewHistoryJson),
      {
        action,
        from: row.status,
        to,
        actorId,
        at: new Date().toISOString(),
        ...(comment ? { comment } : {})
      }
    ];
  }

  private toDto(row: CoursePlanRow): Record<string, unknown> {
    const metadata = objectJson(row.metadataJson);
    return {
      id: row.id,
      course: row.course,
      class: row.learningClass ?? (
        typeof metadata.className === "string" ? { id: null, code: null, name: metadata.className } : null
      ),
      title: row.title,
      gradeBand: row.gradeBand,
      goals: stringArray(row.goalsJson),
      durationWeeks: row.durationWeeks,
      status: row.status,
      version: row.version,
      provider: row.provider,
      modelVersion: row.modelVersion,
      generatedFromExistingCatalog: true,
      humanReviewRequired: true,
      planJson: row.planJson,
      aiDraftJson: row.aiDraftJson,
      reviewHistory: reviewEntries(row.reviewHistoryJson),
      teacherEditingSeconds: row.teacherEditingSeconds,
      generationMs: typeof metadata.generationMs === "number" ? metadata.generationMs : null,
      requestedBy: row.requestedBy,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
}
