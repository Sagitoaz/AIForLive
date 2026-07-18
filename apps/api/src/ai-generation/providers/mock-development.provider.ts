import { Injectable } from "@nestjs/common";
import type { GenerateContentDto } from "../dto/generate-content.dto";
import type { ContentProvider, ProviderOutput } from "./content-provider";
import { LocalTemplateProvider } from "./local-template.provider";

@Injectable()
export class MockDevelopmentProvider implements ContentProvider {
  readonly code = "MOCK_DEVELOPMENT";
  constructor(private readonly local: LocalTemplateProvider) {}

  generate(input: GenerateContentDto): Promise<ProviderOutput> {
    return this.local.generate(input);
  }
}
