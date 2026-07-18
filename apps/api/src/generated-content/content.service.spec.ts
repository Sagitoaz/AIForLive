import { GenerateContentDto } from "../ai-generation/dto/generate-content.dto";
import { ExternalLlmProvider } from "../ai-generation/providers/external-llm.provider";
import { LocalTemplateProvider } from "../ai-generation/providers/local-template.provider";
import { MockDevelopmentProvider } from "../ai-generation/providers/mock-development.provider";
import { DomainRegistryService } from "../domains/domain-registry.service";
import { DemoStoreService } from "../shared/demo-store.service";
import { ContentService } from "./content.service";
import { ContentValidatorService } from "./content-validator.service";
import { ContentSourceService } from "./content-source.service";

function service(): ContentService {
  const store = new DemoStoreService();
  const local = new LocalTemplateProvider();
  const mock = new MockDevelopmentProvider(local);
  return new ContentService(store, new DomainRegistryService(), local, new ExternalLlmProvider(), mock, new ContentValidatorService(), new ContentSourceService());
}

function input(): GenerateContentDto {
  return Object.assign(new GenerateContentDto(), {
    domainCode: "python-foundations",
    conceptCode: "PYTHON_RANGE",
    misconceptionCode: "RANGE_STOP_INCLUDED",
    level: "Mới bắt đầu",
    learningObjective: "Biết rằng stop không thuộc dãy",
    durationMinutes: 5,
    sourceId: "source-python-handbook-01",
    provider: "LOCAL_TEMPLATE"
  });
}

describe("ContentService", () => {
  it("keeps generated content in draft until reviewed", async () => {
    const content = await service().generate(input());
    expect(content.status).toBe("DRAFT");
    expect(content.slides.length).toBeGreaterThanOrEqual(3);
    expect(content.sections?.map((section) => section.phase)).toEqual(["THEORY", "PRACTICE", "CHECKPOINT"]);
    expect(content.sourceReferences).toEqual(["source-python-handbook-01"]);
  });

  it("prevents students from reading draft content", async () => {
    const contentService = service();
    const content = await contentService.generate(input());
    expect(() => contentService.getPublished(content.id)).toThrow("Published micro-lesson not found");
  });

  it("supports edit, approve and publish with history", async () => {
    const contentService = service();
    const content = await contentService.generate(input());
    contentService.edit(content.id, { title: "Range không chạm vạch đích" });
    contentService.approve(content.id, "Nội dung chính xác");
    const published = contentService.publish(content.id, "Sẵn sàng cho học viên");
    expect(published.status).toBe("PUBLISHED");
    expect(published.reviewHistory).toHaveLength(2);
  });

  it("reuses an approved published lesson without a second provider call", async () => {
    const contentService = service();
    const first = await contentService.generate(input());
    contentService.approve(first.id);
    contentService.publish(first.id);
    const reused = await contentService.generate(input());
    expect(reused.id).toBe(first.id);
    expect(reused.reused).toBe(true);
    expect(reused.reuseCount).toBe(1);
  });

  it("rejects generation from a source that has not been reviewed", async () => {
    const unverified = input();
    unverified.sourceId = "unknown-upload";
    await expect(service().generate(unverified)).rejects.toThrow("Content source not found");
  });
});
