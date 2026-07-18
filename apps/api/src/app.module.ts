import { Module } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { ContentModule } from "./generated-content/content.module";
import { DemoStoreModule } from "./shared/demo-store.module";
import { DomainRegistryModule } from "./domains/domain-registry.module";
import { GamesModule } from "./games/games.module";
import { HealthModule } from "./health/health.module";
import { LearningModule } from "./learning-events/learning.module";
import { StudentsModule } from "./students/students.module";
import { TeacherModule } from "./teacher/teacher.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DemoStoreModule,
    DomainRegistryModule,
    AuthModule,
    LearningModule,
    StudentsModule,
    TeacherModule,
    ContentModule,
    GamesModule,
    HealthModule
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule {}
