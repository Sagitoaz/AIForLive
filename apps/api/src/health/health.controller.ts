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
    return {
      status: "ok",
      service: "edurecall-core-api",
      version: "0.2.0",
      timestamp: new Date().toISOString(),
      dependencies: { database: "supabase-postgresql-ready", personalization: "python-ai-service" }
    };
  }
}
