import { Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DemoStoreService } from "../shared/demo-store.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly store: DemoStoreService) {}

  @Get()
  health(): Record<string, unknown> {
    return {
      status: "ok",
      service: "edurecall-core-api",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      dependencies: { database: "demo-memory-ready", personalization: "fallback-capable" }
    };
  }

  @Post("demo-reset")
  reset(): Record<string, unknown> {
    this.store.reset();
    return { reset: true, at: new Date().toISOString() };
  }
}
