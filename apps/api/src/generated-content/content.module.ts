import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ExternalLlmProvider } from "../ai-generation/providers/external-llm.provider";
import { LocalTemplateProvider } from "../ai-generation/providers/local-template.provider";
import { MockDevelopmentProvider } from "../ai-generation/providers/mock-development.provider";
import { ContentController } from "./content.controller";
import { ContentService } from "./content.service";
import { ContentSourceService } from "./content-source.service";
import { ContentValidatorService } from "./content-validator.service";

@Module({
  imports: [AuthModule],
  controllers: [ContentController],
  providers: [ContentService, ContentSourceService, ContentValidatorService, LocalTemplateProvider, ExternalLlmProvider, MockDevelopmentProvider],
  exports: [ContentService]
})
export class ContentModule {}
