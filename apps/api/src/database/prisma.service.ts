import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required. The API has no in-memory data fallback.");
    }
    super({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
  }

  async onModuleInit(): Promise<void> {
    const attempts = Number(process.env.DATABASE_CONNECT_ATTEMPTS ?? 6);
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await this.$connect();
        await this.$queryRaw`SELECT 1`;
        this.logger.log("Supabase PostgreSQL connection is ready");
        return;
      } catch (error) {
        await this.$disconnect().catch(() => undefined);
        const message = error instanceof Error ? error.message.split("\n")[0] : "Unknown database error";
        if (attempt >= attempts) {
          this.logger.error(`Supabase connection failed after ${attempts} attempts: ${message}`);
          throw error;
        }
        const delayMs = Math.min(2_000 * attempt, 10_000);
        this.logger.warn(`Supabase is not ready (attempt ${attempt}/${attempts}): ${message}; retrying in ${delayMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
