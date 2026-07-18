import { Module } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { ContentModule } from "./generated-content/content.module";
import { PrismaModule } from "./database/prisma.module";
import { DomainRegistryModule } from "./domains/domain-registry.module";
import { GamesModule } from "./games/games.module";
import { HealthModule } from "./health/health.module";
import { LearningModule } from "./learning-events/learning.module";
import { StudentsModule } from "./students/students.module";
import { TeacherModule } from "./teacher/teacher.module";
import { TtsModule } from "./tts/tts.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    DomainRegistryModule,
    AuthModule,
    LearningModule,
    StudentsModule,
    TeacherModule,
    ContentModule,
    TtsModule,
    GamesModule,
    HealthModule
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule {}
