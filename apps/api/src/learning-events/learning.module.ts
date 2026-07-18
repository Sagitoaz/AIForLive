import { Module } from "@nestjs/common";
import { DiagnosticsController } from "./diagnostics.controller";
import { LearningController } from "./learning.controller";
import { LearningService } from "./learning.service";
import { AiClientService } from "../personalization/ai-client.service";
import { FallbackAnalysisService } from "../personalization/fallback-analysis.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [LearningController, DiagnosticsController],
  providers: [LearningService, AiClientService, FallbackAnalysisService],
  exports: [LearningService]
})
export class LearningModule {}
