import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ActivityType, LearningEventStatus, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../database/prisma.service";

type DiagnosticPayload = {
  exerciseIds: string[];
  responses: Array<{ exerciseId: string; submittedAnswer: string; answeredAt: string }>;
};

@ApiTags("diagnostics")
@ApiBearerAuth()
@Roles("STUDENT")
@UseGuards(AuthGuard, RolesGuard)
@Controller("diagnostics")
export class DiagnosticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("start")
  async start(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>> {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { status: "ACTIVE", student: { userId: request.user.id } },
      include: { course: true },
      orderBy: { enrolledAt: "desc" }
    });
    if (!enrollment) throw new NotFoundException("Active enrollment not found");
    const exercises = await this.prisma.exercise.findMany({
      where: {
        lesson: { module: { courseId: enrollment.courseId } },
        status: "ACTIVE",
        deletedAt: null,
        metadataJson: { path: ["placement"], equals: true }
      },
      include: { concepts: { include: { concept: true } } },
      orderBy: { difficulty: "asc" },
      take: 8
    });
    if (!exercises.length) throw new BadRequestException("Khóa học chưa có bộ câu hỏi đầu vào đã được giáo viên duyệt");
    const payload: DiagnosticPayload = { exerciseIds: exercises.map((item) => item.id), responses: [] };
    const event = await this.prisma.learningEvent.create({
      data: {
        idempotencyKey: `placement-${request.user.id}-${randomUUID()}`,
        userId: request.user.id,
        courseId: enrollment.courseId,
        type: ActivityType.DIAGNOSTIC,
        status: LearningEventStatus.PENDING_ANALYSIS,
        correlationId: randomUUID(),
        payloadJson: payload as unknown as Prisma.InputJsonValue,
        metadataJson: { diagnosticType: "PLACEMENT", version: "placement-v1" }
      }
    });
    return {
      id: event.id,
      status: "IN_PROGRESS",
      questions: exercises.map((exercise) => ({
        id: exercise.id,
        code: exercise.code,
        conceptCode: exercise.concepts.find((item) => item.isPrimary)?.concept.code ?? exercise.concepts[0]?.concept.code,
        prompt: exercise.prompt,
        type: exercise.type,
        difficulty: exercise.difficulty,
        content: this.publicContent(exercise.contentJson)
      }))
    };
  }

  @Post(":id/answer")
  async answer(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: { exerciseId?: string; submittedAnswer?: string }
  ): Promise<Record<string, unknown>> {
    if (!body.exerciseId || typeof body.submittedAnswer !== "string") {
      throw new BadRequestException("exerciseId and submittedAnswer are required");
    }
    const event = await this.event(id, request.user.id);
    if (event.status !== LearningEventStatus.PENDING_ANALYSIS) throw new BadRequestException("Diagnostic is already completed");
    const payload = this.payload(event.payloadJson);
    if (!payload.exerciseIds.includes(body.exerciseId)) throw new BadRequestException("Question does not belong to this diagnostic");
    const responses = payload.responses.filter((item) => item.exerciseId !== body.exerciseId);
    responses.push({ exerciseId: body.exerciseId, submittedAnswer: body.submittedAnswer, answeredAt: new Date().toISOString() });
    await this.prisma.learningEvent.update({
      where: { id },
      data: { payloadJson: { ...payload, responses } as unknown as Prisma.InputJsonValue }
    });
    return { diagnosticId: id, accepted: true, remaining: Math.max(0, payload.exerciseIds.length - responses.length) };
  }

  @Post(":id/complete")
  async complete(@Req() request: AuthenticatedRequest, @Param("id") id: string): Promise<Record<string, unknown>> {
    const event = await this.event(id, request.user.id);
    if (event.status !== LearningEventStatus.PENDING_ANALYSIS) return this.result(request, id);
    const payload = this.payload(event.payloadJson);
    const exercises = await this.prisma.exercise.findMany({
      where: { id: { in: payload.exerciseIds } },
      include: { concepts: { include: { concept: true } } }
    });
    const profile = await this.prisma.studentProfile.findUnique({ where: { userId: request.user.id } });
    if (!profile) throw new NotFoundException("Student profile not found");
    const scored = exercises.map((exercise) => {
      const response = payload.responses.find((item) => item.exerciseId === exercise.id);
      const key = this.answerKey(exercise.answerJson);
      const correct = Boolean(response && key.some((answer) => this.normalize(answer) === this.normalize(response.submittedAnswer)));
      const concept = exercise.concepts.find((item) => item.isPrimary)?.concept ?? exercise.concepts[0]?.concept;
      if (!concept) throw new BadRequestException(`Exercise ${exercise.code} has no concept mapping`);
      const mastery = Number(Math.max(0.08, Math.min(0.92, correct ? 0.58 + exercise.difficulty * 0.34 : 0.18 + exercise.difficulty * 0.18)).toFixed(4));
      return { exercise, response, correct, concept, mastery };
    });
    const output = {
      scores: scored.map((item) => ({ exerciseId: item.exercise.id, conceptCode: item.concept.code, correct: item.correct, mastery: item.mastery })),
      completedQuestions: payload.responses.length,
      totalQuestions: payload.exerciseIds.length
    };
    await this.prisma.$transaction(async (tx) => {
      for (const item of scored) {
        await tx.studentConceptState.upsert({
          where: { studentProfileId_conceptId: { studentProfileId: profile.id, conceptId: item.concept.id } },
          update: {
            mastery: item.mastery,
            stability: 1.5,
            retrievability: Math.max(0.1, item.mastery - 0.05),
            forgettingRisk: Math.min(0.9, 1.05 - item.mastery),
            nextAttemptProbability: item.mastery * 0.82,
            modelVersion: "placement-v1",
            version: { increment: 1 }
          },
          create: {
            studentProfileId: profile.id,
            conceptId: item.concept.id,
            mastery: item.mastery,
            stability: 1.5,
            retrievability: Math.max(0.1, item.mastery - 0.05),
            forgettingRisk: Math.min(0.9, 1.05 - item.mastery),
            nextAttemptProbability: item.mastery * 0.82,
            modelVersion: "placement-v1"
          }
        });
        await tx.conceptStateHistory.create({
          data: {
            studentProfileId: profile.id,
            conceptId: item.concept.id,
            mastery: item.mastery,
            stability: 1.5,
            retrievability: Math.max(0.1, item.mastery - 0.05),
            forgettingRisk: Math.min(0.9, 1.05 - item.mastery),
            triggerEventId: event.id,
            modelVersion: "placement-v1",
            metadataJson: { diagnostic: true, correct: item.correct }
          }
        });
      }
      await tx.personalizationRun.create({
        data: {
          learningEventId: event.id,
          studentProfileId: profile.id,
          mode: "PLACEMENT_RULES",
          inputJson: event.payloadJson as Prisma.InputJsonValue,
          outputJson: output as unknown as Prisma.InputJsonValue,
          durationMs: 0,
          correlationId: event.correlationId
        }
      });
      await tx.learningEvent.update({
        where: { id: event.id },
        data: { status: LearningEventStatus.ANALYZED, analyzedAt: new Date() }
      });
      const enrollment = await tx.enrollment.findFirst({ where: { courseId: event.courseId, studentProfileId: profile.id } });
      if (enrollment) {
        const metadata = this.objectJson(enrollment.metadataJson);
        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: { metadataJson: { ...metadata, placementCompleted: true, placementEventId: event.id } }
        });
      }
    });
    return { diagnosticId: event.id, status: "COMPLETED", ...output };
  }

  @Get(":id/result")
  async result(@Req() request: AuthenticatedRequest, @Param("id") id: string): Promise<Record<string, unknown>> {
    const event = await this.event(id, request.user.id);
    const run = await this.prisma.personalizationRun.findUnique({ where: { learningEventId: event.id } });
    if (!run) return { diagnosticId: id, status: "IN_PROGRESS" };
    const output = this.objectJson(run.outputJson);
    const scores = Array.isArray(output.scores) ? output.scores as Array<Record<string, unknown>> : [];
    const sorted = [...scores].sort((left, right) => Number(right.mastery ?? 0) - Number(left.mastery ?? 0));
    return {
      diagnosticId: id,
      status: "COMPLETED",
      strongest: sorted[0]?.conceptCode ?? null,
      focus: sorted.filter((item) => Number(item.mastery ?? 0) < 0.5).map((item) => item.conceptCode),
      scores,
      pathVersion: `placement-${event.updatedAt.getTime()}`
    };
  }

  private event(id: string, userId: string) {
    return this.prisma.learningEvent.findFirst({ where: { id, userId, type: ActivityType.DIAGNOSTIC } }).then((row) => {
      if (!row) throw new NotFoundException("Diagnostic not found");
      return row;
    });
  }

  private payload(value: Prisma.JsonValue): DiagnosticPayload {
    const object = this.objectJson(value);
    return {
      exerciseIds: Array.isArray(object.exerciseIds) ? object.exerciseIds.filter((item): item is string => typeof item === "string") : [],
      responses: Array.isArray(object.responses)
        ? object.responses.filter((item): item is DiagnosticPayload["responses"][number] => Boolean(item && typeof item === "object" && !Array.isArray(item) && typeof item.exerciseId === "string" && typeof item.submittedAnswer === "string"))
        : []
    };
  }

  private answerKey(value: Prisma.JsonValue): string[] {
    const object = this.objectJson(value);
    const answers = Array.isArray(object.acceptedAnswers) ? object.acceptedAnswers.filter((item): item is string => typeof item === "string") : [];
    if (!answers.length || object.teacherReviewed !== true) throw new BadRequestException("Placement question has no reviewed answer key");
    return answers;
  }

  private publicContent(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
    const publicContent = { ...this.objectJson(value) };
    Reflect.deleteProperty(publicContent, "acceptedAnswers");
    return publicContent;
  }

  private objectJson(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
    return value && !Array.isArray(value) && typeof value === "object" ? value as Record<string, Prisma.JsonValue> : {};
  }

  private normalize(value: string): string {
    return value.toLowerCase().replace(/\s+/g, "").replaceAll("[", "").replaceAll("]", "");
  }
}
