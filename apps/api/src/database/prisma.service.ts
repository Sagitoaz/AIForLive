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
    await this.$connect();
    await this.$queryRaw`SELECT 1`;
    this.logger.log("Supabase PostgreSQL connection is ready");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
