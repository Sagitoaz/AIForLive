import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../database/prisma.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health(): Promise<Record<string, unknown>> {
    await this.prisma.$queryRaw`SELECT 1`;
    let personalization = "fallback-only";
    try {
      const response = await fetch(`${process.env.AI_SERVICE_URL ?? "http://localhost:8001"}/health`, {
        signal: AbortSignal.timeout(1_500)
      });
      if (response.ok) personalization = "python-ai-ready";
    } catch {
      // The API deliberately remains available: attempt analysis has a labeled,
      // deterministic fallback and its mode is persisted for audit.
    }
    return {
      status: "ok",
      service: "edurecall-core-api",
      version: "0.2.0",
      timestamp: new Date().toISOString(),
      dependencies: { database: "supabase-postgresql-ready", personalization }
    };
  }
}
