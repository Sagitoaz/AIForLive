import { BadRequestException } from "@nestjs/common";
import type { GeneratedLearningContent } from "../common/types";
import { ExternalLlmProvider } from "../ai-generation/providers/external-llm.provider";
import { LocalTemplateProvider } from "../ai-generation/providers/local-template.provider";
import type { ProviderOutput } from "../ai-generation/providers/content-provider";
import { PrismaService } from "../database/prisma.service";
import { ContentService } from "./content.service";
import { ContentSourceService } from "./content-source.service";
import { ContentValidatorService } from "./content-validator.service";

const providerOutput: ProviderOutput = {
  title: "Khung bài học 3 pha: biến",
  objectives: ["Giải thích được cách một biến lưu giá trị"],
  sourceReferences: ["source-1"],
  slides: [
    { id: "slide-1", order: 1, type: "CONCEPT" as const, title: "Khái niệm", body: "Biến lưu một giá trị.", narration: "Biến lưu một giá trị.", animationTemplate: "VARIABLE_CHANGE", animationData: { variable: "x", before: 1, after: 2 } },
    { id: "slide-2", order: 2, type: "EXAMPLE" as const, title: "Ví dụ", body: "Gán x bằng 2.", narration: "Gán x bằng hai.", animationTemplate: "VARIABLE_CHANGE", animationData: { variable: "x", before: 1, after: 2 } },
    { id: "slide-3", order: 3, type: "MISCONCEPTION" as const, title: "Điểm dễ nhầm", body: "Phân biệt tên và giá trị.", narration: "Tên biến khác giá trị.", animationTemplate: "BUG_REVEAL", animationData: { wrongLine: "x == 2", fixedLine: "x = 2", message: "Phép gán" } }
  ],
  quiz: { question: "Câu nào gán 2 cho x?", options: ["x = 2", "x == 2"], correctIndex: 0, explanation: "Dấu bằng là phép gán." },
  provider: "LOCAL_TEMPLATE" as const,
  generationMs: 12,
  estimatedCostUsd: 0,
  sections: [
    { phase: "THEORY" as const, title: "Lý thuyết", durationMinutes: 20, summary: "Đọc và xem ví dụ.", activityTypes: ["LECTURE" as const] },
    { phase: "PRACTICE" as const, title: "Thực hành", durationMinutes: 30, summary: "Thử các phép gán.", activityTypes: ["CODE" as const] },
    { phase: "CHECKPOINT" as const, title: "Kiểm tra", durationMinutes: 15, summary: "Trả lời câu mới.", activityTypes: ["MULTIPLE_CHOICE" as const] }
  ]
};

const generatedDto: GeneratedLearningContent = {
  id: "content-1",
  title: providerOutput.title,
  domainCode: "python-foundations",
  conceptCode: "PYTHON_VARIABLES",
  misconceptionCode: "UNKNOWN",
  level: "Mới bắt đầu",
  objectives: providerOutput.objectives,
  sourceReferences: providerOutput.sourceReferences,
  slides: providerOutput.slides,
  quiz: providerOutput.quiz,
  practiceQuestions: [
    {
      question: "Câu nội bộ không được lộ đáp án?",
      options: ["A", "B"],
      correctIndex: 1,
      explanation: "B là đáp án đã duyệt."
    }
  ],
  status: "DRAFT",
  provider: "LOCAL_TEMPLATE",
  reuseCount: 0,
  version: 1,
  generationMs: 12,
  teacherEditingSeconds: 0,
  estimatedCostUsd: 0,
  requestedBy: { id: "teacher-1", displayName: "Cô Mai" },
  generationTrace: {
    model: "private-model",
    promptTokens: 10,
    completionTokens: 20,
    promptHash: "private-prompt-hash"
  },
  reviewHistory: [{
    action: "APPROVE",
    from: "IN_REVIEW",
    to: "APPROVED",
    at: new Date(0).toISOString(),
    comment: "Internal reviewer note"
  }],
  updatedAt: new Date(0).toISOString()
};

interface Harness {
  service: ContentService;
  prisma: {
    learningConcept: { findFirst: jest.Mock };
    misconception: { findFirst: jest.Mock };
    generatedContent: { findFirst: jest.Mock };
    aiGenerationJob: { create: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  createContent: jest.Mock;
}

function harness(misconception: { id: string } | null = null): Harness {
  const createContent = jest.fn().mockResolvedValue({ id: "content-row" });
  const updateJob = jest.fn();
  const createAuditLog = jest.fn();
  const prisma: Harness["prisma"] = {
    learningConcept: { findFirst: jest.fn().mockResolvedValue({ id: "concept-variables", code: "PYTHON_VARIABLES" }) },
    misconception: { findFirst: jest.fn().mockResolvedValue(misconception) },
    generatedContent: { findFirst: jest.fn() },
    aiGenerationJob: { create: jest.fn().mockResolvedValue({ id: "job-1" }), update: updateJob },
    auditLog: { create: createAuditLog },
    $transaction: jest.fn(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => callback({
      aiGenerationJob: { update: updateJob },
      generatedContent: { create: createContent },
      auditLog: { create: createAuditLog }
    }))
  };
  const local = { generate: jest.fn().mockResolvedValue(providerOutput) };
  const sources = {
    verifiedExcerpt: jest.fn().mockResolvedValue({
      source: { id: "source-1", courseId: "course-1", checksum: "checksum-1" },
      text: "Nguồn đã xác minh có đủ nội dung để tạo một khung bài học an toàn."
    })
  };
  const validator = { validate: jest.fn() };
  const service = new ContentService(
    prisma as unknown as PrismaService,
    local as unknown as LocalTemplateProvider,
    {} as ExternalLlmProvider,
    validator as unknown as ContentValidatorService,
    sources as unknown as ContentSourceService
  );
  const internals = service as unknown as { toDto(row: unknown): GeneratedLearningContent };
  jest.spyOn(internals, "toDto").mockReturnValue(generatedDto);
  return { service, prisma, createContent };
}

function fullLessonInput() {
  return {
    domainCode: "python-foundations",
    conceptCode: "PYTHON_VARIABLES",
    level: "Mới bắt đầu",
    learningObjective: "Giải thích được cách biến lưu giá trị",
    durationMinutes: 65,
    draftKind: "FULL_LESSON" as const,
    gradeBand: "Lớp 6–9",
    sourceId: "source-1",
    provider: "LOCAL_TEMPLATE" as const
  };
}

describe("ContentService generation brief validation", () => {
  it("creates a FULL_LESSON without a misconception and persists a null relation", async () => {
    const test = harness();

    await expect(test.service.generate(fullLessonInput(), "teacher-1")).resolves.toMatchObject({ id: "content-1" });

    expect(test.prisma.misconception.findFirst).not.toHaveBeenCalled();
    expect(test.prisma.aiGenerationJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        promptVersion: "local-template-vi-v2",
        contextJson: expect.objectContaining({
          groundingMode: "VERIFIED_SOURCE_ATTACHED_TEMPLATE_NOT_INTERPRETED"
        })
      })
    });
    expect(test.prisma.learningConcept.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        code: "PYTHON_VARIABLES",
        lessons: {
          some: expect.objectContaining({
            module: {
              course: expect.objectContaining({ id: "course-1" })
            }
          })
        }
      })
    });
    const createInput = test.createContent.mock.calls[0]?.[0] as {
      data: {
        educationalValidationJson: { status: string; humanReviewRequired: boolean };
        codeValidationJson: { status: string };
        microLesson: { create: { misconceptionId: string | null } };
        versions: { create: { changeSummary: string } };
      };
    };
    expect(createInput.data.microLesson.create.misconceptionId).toBeNull();
    expect(createInput.data.educationalValidationJson).toMatchObject({
      status: "PENDING_TEACHER_REVIEW",
      humanReviewRequired: true
    });
    expect(createInput.data.codeValidationJson.status).toBe("NOT_EXECUTED");
    expect(createInput.data.versions.create.changeSummary).toContain("LOCAL_TEMPLATE");
  });

  it("rejects a REMEDIATION brief without a misconception code", async () => {
    const test = harness();

    await expect(test.service.generate({
      ...fullLessonInput(),
      draftKind: "REMEDIATION",
      durationMinutes: 7
    }, "teacher-1")).rejects.toThrow(new BadRequestException("Bài bổ trợ phải chọn một misconception thuộc concept đang dạy"));
    expect(test.prisma.misconception.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a misconception that is not registered for the selected concept", async () => {
    const test = harness(null);

    await expect(test.service.generate({
      ...fullLessonInput(),
      draftKind: "REMEDIATION",
      durationMinutes: 7,
      misconceptionCode: "RANGE_STOP_INCLUDED"
    }, "teacher-1")).rejects.toThrow(new BadRequestException("Misconception không tồn tại hoặc không thuộc concept đang dạy"));
    expect(test.prisma.misconception.findFirst).toHaveBeenCalledWith({
      where: {
        code: "RANGE_STOP_INCLUDED",
        conceptId: "concept-variables",
        status: "ACTIVE",
        deletedAt: null
      }
    });
  });

  it("persists the concept-scoped misconception for a valid REMEDIATION brief", async () => {
    const test = harness({ id: "misconception-variables" });

    await test.service.generate({
      ...fullLessonInput(),
      draftKind: "REMEDIATION",
      durationMinutes: 7,
      misconceptionCode: "VARIABLE_VALUE_IS_NAME"
    }, "teacher-1");

    const createInput = test.createContent.mock.calls[0]?.[0] as {
      data: { microLesson: { create: { misconceptionId: string | null } } };
    };
    expect(createInput.data.microLesson.create.misconceptionId).toBe("misconception-variables");
    expect(test.prisma.misconception.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        code: "VARIABLE_VALUE_IS_NAME",
        conceptId: "concept-variables"
      })
    });
    expect(test.prisma.generatedContent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        generationJob: {
          requestedById: "teacher-1",
          courseId: "course-1"
        }
      })
    }));
  });

  it("lists misconceptions only through an assigned class, including co-teacher membership", async () => {
    const test = harness();
    test.prisma.learningConcept.findFirst.mockResolvedValueOnce({
      misconceptions: [{
        id: "misconception-variables",
        code: "VARIABLE_VALUE_IS_NAME",
        title: "Nhầm tên biến với giá trị",
        description: "Học sinh coi tên biến là chính giá trị đang lưu.",
        severity: "MEDIUM"
      }]
    });

    await expect(test.service.listMisconceptions("PYTHON_VARIABLES", "teacher-2")).resolves.toEqual([
      expect.objectContaining({ code: "VARIABLE_VALUE_IS_NAME" })
    ]);
    expect(test.prisma.learningConcept.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        lessons: {
          some: expect.objectContaining({
            module: {
              course: expect.objectContaining({
                enrollments: {
                  some: {
                    class: expect.objectContaining({
                      OR: expect.arrayContaining([
                        expect.objectContaining({ teacherMemberships: expect.any(Object) })
                      ])
                    })
                  }
                }
              })
            }
          })
        }
      })
    }));
  });

  it("scopes a published student read to an active enrollment and strips answer keys and authoring audit data", async () => {
    const test = harness();
    test.prisma.generatedContent.findFirst.mockResolvedValue({ id: "content-row" });

    const result = await test.service.getPublished("micro-lesson-1", "student-user-1");

    expect(test.prisma.generatedContent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [{ id: "micro-lesson-1" }, { microLesson: { id: "micro-lesson-1" } }],
        status: "PUBLISHED",
        microLesson: { status: "PUBLISHED" },
        generationJob: {
          course: expect.objectContaining({
            status: "ACTIVE",
            deletedAt: null,
            enrollments: {
              some: expect.objectContaining({
                status: "ACTIVE",
                deletedAt: null,
                student: {
                  userId: "student-user-1",
                  status: "ACTIVE",
                  deletedAt: null
                }
              })
            }
          })
        }
      })
    }));
    expect(result.quiz).toEqual({
      question: generatedDto.quiz.question,
      options: generatedDto.quiz.options
    });
    expect(result.practiceQuestions).toEqual([{
      question: generatedDto.practiceQuestions?.[0]?.question,
      options: generatedDto.practiceQuestions?.[0]?.options
    }]);
    expect(result).not.toHaveProperty("provider");
    expect(result).not.toHaveProperty("generationTrace");
    expect(result).not.toHaveProperty("reviewHistory");
    expect(JSON.stringify(result)).not.toContain("correctIndex");
    expect(JSON.stringify(result)).not.toContain("Internal reviewer note");
    expect(JSON.stringify(result)).not.toContain("private-prompt-hash");
  });

  it("requires an assigned OWNER/REVIEWER and prevents the draft author from self-approving", async () => {
    const test = harness();
    test.prisma.generatedContent.findFirst.mockResolvedValue({
      id: "content-1",
      status: "IN_REVIEW",
      generationJob: { requestedById: "teacher-1" }
    });

    await expect(test.service.approve("content-1", "Tự duyệt", "teacher-1"))
      .rejects.toThrow("Người tạo bản nháp không thể tự duyệt hoặc xuất bản nội dung của mình");

    expect(test.prisma.generatedContent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        generationJob: {
          course: expect.objectContaining({
            enrollments: {
              some: expect.objectContaining({
                class: expect.objectContaining({
                  OR: expect.arrayContaining([
                    expect.objectContaining({
                      teacherMemberships: {
                        some: expect.objectContaining({ role: { in: ["OWNER", "REVIEWER"] } })
                      }
                    })
                  ])
                })
              })
            }
          })
        }
      })
    }));
  });

  it("prevents the last human editor from approving the same content version", async () => {
    const test = harness();
    test.prisma.generatedContent.findFirst.mockResolvedValue({
      id: "content-1",
      status: "IN_REVIEW",
      metadataJson: { lastEditedById: "reviewer-editor" },
      generationJob: { requestedById: "original-author" }
    });

    await expect(test.service.approve("content-1", "Tự duyệt sau khi sửa", "reviewer-editor"))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
