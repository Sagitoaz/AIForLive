import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../database/prisma.service";

@ApiTags("games")
@ApiBearerAuth()
@Roles("STUDENT")
@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class GamesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("games")
  async list(@Req() request: AuthenticatedRequest): Promise<Record<string, unknown>[]> {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { status: "ACTIVE", student: { userId: request.user.id } },
      orderBy: { enrolledAt: "desc" }
    });
    if (!enrollment) throw new NotFoundException("Active enrollment not found");
    const games = await this.prisma.game.findMany({
      where: { courseId: enrollment.courseId, status: "ACTIVE", deletedAt: null },
      include: { levels: { where: { status: "ACTIVE" }, orderBy: { level: "asc" } } },
      orderBy: { createdAt: "asc" }
    });
    return games.map((game) => ({
      id: game.id,
      code: game.code,
      type: game.type,
      title: game.title,
      description: game.description,
      cover: game.coverAssetKey,
      levels: game.levels.map((level) => ({ id: level.id, level: level.level, title: level.title, rewardXp: level.rewardXp }))
    }));
  }

  @Post("games/:id/start")
  async start(@Req() request: AuthenticatedRequest, @Param("id") id: string): Promise<Record<string, unknown>> {
    const game = await this.prisma.game.findFirst({
      where: { OR: [{ id }, { code: id }], status: "ACTIVE", deletedAt: null },
      include: { levels: { where: { status: "ACTIVE" }, orderBy: { level: "asc" }, take: 1 } }
    });
    const level = game?.levels[0];
    if (!game || !level) throw new NotFoundException("Game or level not found");
    const enrolled = await this.prisma.enrollment.count({
      where: { courseId: game.courseId, status: "ACTIVE", student: { userId: request.user.id } }
    });
    if (!enrolled) throw new NotFoundException("Game not available for this student");
    const session = await this.prisma.gameSession.create({
      data: { userId: request.user.id, gameLevelId: level.id, score: 0, xpEarned: 0, resultJson: {} }
    });
    return {
      sessionId: session.id,
      game: { id: game.id, code: game.code, title: game.title, type: game.type },
      level: { id: level.id, level: level.level, title: level.title, content: this.publicLevel(level.contentJson) },
      startedAt: session.startedAt.toISOString()
    };
  }

  @Post("game-sessions/:id/complete")
  async complete(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: { submittedAnswer?: string; score?: number }
  ): Promise<Record<string, unknown>> {
    const session = await this.prisma.gameSession.findFirst({
      where: { id, userId: request.user.id },
      include: { gameLevel: true }
    });
    if (!session) throw new NotFoundException("Game session not found");
    if (session.completed) throw new BadRequestException("Game session is already completed");
    const content = this.objectJson(session.gameLevel.contentJson);
    const accepted = Array.isArray(content.acceptedAnswers)
      ? content.acceptedAnswers.filter((item): item is string => typeof item === "string")
      : [];
    if (!accepted.length) throw new BadRequestException("Game level has no teacher-reviewed answer key");
    const submitted = (body.submittedAnswer ?? "").trim().toLowerCase();
    const correct = accepted.some((answer) => answer.trim().toLowerCase() === submitted);
    const score = Math.max(0, Math.min(100, correct ? body.score ?? 100 : body.score ?? 40));
    const xp = correct ? session.gameLevel.rewardXp : Math.max(5, Math.round(session.gameLevel.rewardXp * 0.3));
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.gameSession.update({
        where: { id },
        data: {
          completed: true,
          completedAt: new Date(),
          score,
          xpEarned: xp,
          resultJson: { submittedAnswer: body.submittedAnswer ?? "", correct }
        }
      });
      await tx.studentProfile.update({ where: { userId: request.user.id }, data: { xp: { increment: xp } } });
      await tx.xpEvent.create({
        data: { userId: request.user.id, amount: xp, reason: "Hoàn thành hoạt động luyện tập", sourceType: "GAME_SESSION", sourceId: id }
      });
      return row;
    });
    return { sessionId: updated.id, completed: true, score: updated.score, xpEarned: updated.xpEarned, correct };
  }

  private publicLevel(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
    const publicContent = { ...this.objectJson(value) };
    Reflect.deleteProperty(publicContent, "acceptedAnswers");
    return publicContent;
  }

  private objectJson(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
    return value && !Array.isArray(value) && typeof value === "object"
      ? (value as Record<string, Prisma.JsonValue>)
      : {};
  }
}
