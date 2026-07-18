import { GenerateContentDto } from "../ai-generation/dto/generate-content.dto";
import { ExternalLlmProvider } from "../ai-generation/providers/external-llm.provider";
import { LocalTemplateProvider } from "../ai-generation/providers/local-template.provider";
import { MockDevelopmentProvider } from "../ai-generation/providers/mock-development.provider";
import { DomainRegistryService } from "../domains/domain-registry.service";
import { DemoStoreService } from "../shared/demo-store.service";
import { ContentService } from "./content.service";
import { ContentValidatorService } from "./content-validator.service";
import { buildSectionsFromLegacy } from "./lesson-sections";
import type { ProviderOutput } from "../ai-generation/providers/content-provider";
import type { DemoContent } from "../common/types";

function service(store = new DemoStoreService()): { content: ContentService; store: DemoStoreService } {
  const local = new LocalTemplateProvider();
  const mock = new MockDevelopmentProvider(local);
  const content = new ContentService(store, new DomainRegistryService(), local, new ExternalLlmProvider(), mock, new ContentValidatorService());
  return { content, store };
}

function input(level = "Lớp 6 mới bắt đầu"): GenerateContentDto {
  return Object.assign(new GenerateContentDto(), {
    domainCode: "python-foundations",
    conceptCode: "PYTHON_RANGE",
    misconceptionCode: "RANGE_STOP_INCLUDED",
    level,
    learningObjective: "Biết rằng stop không thuộc dãy",
    durationMinutes: 5,
    sourceId: "source-python-handbook-01",
    provider: "LOCAL_TEMPLATE"
  });
}

async function baseOutput(level = "Lớp 6 mới bắt đầu"): Promise<ProviderOutput> {
  return new LocalTemplateProvider().generate(input(level));
}

describe("FEATURE-016 data model", () => {
  it("LESSON-HAS-THREE-SECTIONS", async () => {
    const { content } = service();
    const lesson = await content.generate(input());
    expect(lesson.sections).toHaveLength(3);
    expect(lesson.sections.map((section) => section.type).sort()).toEqual(["FINAL_ASSESSMENT", "PRACTICE", "THEORY"]);
  });

  it("LESSON-SECTION-ORDER", async () => {
    const { content } = service();
    const lesson = await content.generate(input());
    const byType = new Map(lesson.sections.map((section) => [section.type, section.order]));
    expect(byType.get("THEORY")).toBe(1);
    expect(byType.get("PRACTICE")).toBe(2);
    expect(byType.get("FINAL_ASSESSMENT")).toBe(3);
  });

  it("LESSON-SECTION-UNIQUE-TYPE", async () => {
    const { content } = service();
    const lesson = await content.generate(input());
    const types = lesson.sections.map((section) => section.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("LESSON-MIGRATION preserves slides and quiz without auto-publishing", async () => {
    const store = new DemoStoreService();
    const { content } = service(store);
    const generated = await content.generate(input());
    // Simulate a legacy record: strip the three-part structure.
    const legacy = store.contents.get(generated.id)! as DemoContent;
    legacy.sections = [];
    const migrated = content.getForTeacher(generated.id);
    expect(migrated.sections).toHaveLength(3);
    const theory = migrated.sections.find((section) => section.type === "THEORY");
    expect(theory?.resources?.length).toBe(legacy.slides.length); // legacy slides preserved as resources
    const final = migrated.sections.find((section) => section.type === "FINAL_ASSESSMENT");
    expect(final?.assessment?.questions[0]?.prompt).toBe(legacy.quiz.question);
    // Migration must never flip the review flag to a student-visible state.
    expect(final?.reviewStatus).toBe("PENDING_REVIEW");
  });

  it("buildSectionsFromLegacy handles a lesson with no quiz safely", () => {
    const sections = buildSectionsFromLegacy({ slides: [], quiz: undefined as never, conceptCode: "PYTHON_RANGE", status: "DRAFT" });
    expect(sections).toHaveLength(3);
    const final = sections.find((section) => section.type === "FINAL_ASSESSMENT");
    expect(final?.assessment?.questions).toHaveLength(0);
  });
});

describe("FEATURE-016 AI generation", () => {
  const validator = new ContentValidatorService();

  it("GEN-THREE-SECTIONS produces theory, practice and final material", async () => {
    const output = await baseOutput();
    expect(output.theory.summary).toBeTruthy();
    expect(output.practice.length).toBeGreaterThan(0);
    expect(output.finalAssessment.questions.length).toBeGreaterThan(0);
    expect(() => validator.validate(output)).not.toThrow();
  });

  it("GEN-MISSING-THEORY-REJECTED", async () => {
    const output = await baseOutput();
    output.theory.summary = "";
    expect(() => validator.validate(output)).toThrow(/Theory/i);
  });

  it("GEN-MISSING-PRACTICE-REJECTED", async () => {
    const output = await baseOutput();
    output.practice = [];
    expect(() => validator.validate(output)).toThrow(/Practice/i);
  });

  it("GEN-MISSING-FINAL-ASSESSMENT-REJECTED", async () => {
    const output = await baseOutput();
    output.finalAssessment.questions = [];
    expect(() => validator.validate(output)).toThrow(/Final assessment/i);
  });

  it("GEN-SKILL-COVERAGE is required", async () => {
    const output = await baseOutput();
    output.finalAssessment.skillCoverage = [];
    expect(() => validator.validate(output)).toThrow(/skill coverage/i);
  });

  it("GEN-LEVEL-ADAPTATION differs between grade 6 and grade 11", async () => {
    const beginner = await baseOutput("Lớp 6 mới bắt đầu");
    const advanced = await baseOutput("Lớp 11 có nền tảng");
    expect(advanced.finalAssessment.questions.length).toBeGreaterThan(beginner.finalAssessment.questions.length);
    expect(advanced.practice[0]!.difficulty).toBeGreaterThan(beginner.practice[0]!.difficulty);
  });

  it("rejects a graded question that has no answer key", async () => {
    const output = await baseOutput();
    output.finalAssessment.questions[0] = { ...output.finalAssessment.questions[0]!, options: undefined, correctIndex: undefined, expectedAnswer: "" };
    expect(() => validator.validate(output)).toThrow(/answer key/i);
  });
});
