import { Injectable } from "@nestjs/common";
import type { ContentGenerationInput, ContentProvider, ProviderOutput } from "./content-provider";
import { LocalTemplateProvider } from "./local-template.provider";

@Injectable()
export class MockDevelopmentProvider implements ContentProvider {
  readonly code = "MOCK_DEVELOPMENT";
  constructor(private readonly local: LocalTemplateProvider) {}

  generate(input: ContentGenerationInput): Promise<ProviderOutput> {
    return this.local.generate(input);
  }
}
