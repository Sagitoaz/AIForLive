import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { randomUUID } from "node:crypto";

const games = [
  { id: "code-order", type: "CODE_ORDER", title: "Code Order", description: "Kéo thả dòng code về đúng thứ tự", cover: "game-asset-01", rewardXp: 35 },
  { id: "predict-output", type: "PREDICT_OUTPUT", title: "Predict the Output", description: "Đọc code và dự đoán kết quả", cover: "game-asset-02", rewardXp: 30 },
  { id: "bug-hunter", type: "BUG_HUNTER", title: "Bug Hunter", description: "Tìm dòng code gây lỗi", cover: "game-asset-03", rewardXp: 40 },
  { id: "range-runner", type: "RANGE_RUNNER", title: "Range Runner", description: "Dừng trước ô stop", cover: "game-asset-04", rewardXp: 45 }
];

@ApiTags("games")
@Controller()
export class GamesController {
  @Get("games")
  list(): typeof games {
    return games;
  }

  @Post("games/:id/start")
  start(@Param("id") id: string): Record<string, unknown> {
    return { sessionId: randomUUID(), game: games.find((item) => item.id === id), level: 1, startedAt: new Date().toISOString() };
  }

  @Post("game-sessions/:id/complete")
  complete(@Param("id") id: string, @Body() body: { score?: number; correct?: boolean }): Record<string, unknown> {
    const correct = Boolean(body.correct);
    return { sessionId: id, completed: true, score: body.score ?? (correct ? 100 : 40), xpEarned: correct ? 40 : 12, badgeUnlocked: correct ? "Debug Seed" : null };
  }
}
