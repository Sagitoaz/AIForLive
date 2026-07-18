import { Module } from "@nestjs/common";
import { ExternalLlmProvider } from "../ai-generation/providers/external-llm.provider";
import { LocalTemplateProvider } from "../ai-generation/providers/local-template.provider";
import { MockDevelopmentProvider } from "../ai-generation/providers/mock-development.provider";
import { ContentController } from "./content.controller";
import { ContentService } from "./content.service";
import { ContentValidatorService } from "./content-validator.service";
import { LessonExportService } from "./lesson-export.service";

@Module({
  controllers: [ContentController],
  providers: [ContentService, ContentValidatorService, LessonExportService, LocalTemplateProvider, ExternalLlmProvider, MockDevelopmentProvider],
  exports: [ContentService]
})
export class ContentModule {}
