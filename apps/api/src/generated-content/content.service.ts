import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AiJobStatus,
  AuditAction,
  ClassTeacherRole,
  ContentStatus,
  Prisma,
  ReviewDecision,
  SlideType
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { GeneratedLearningContent, StudentPublishedLearningContent } from "../common/types";
import { GenerateContentDto } from "../ai-generation/dto/generate-content.dto";
import { ExternalLlmProvider } from "../ai-generation/providers/external-llm.provider";
import { LocalTemplateProvider } from "../ai-generation/providers/local-template.provider";
import type { ProviderOutput } from "../ai-generation/providers/content-provider";
import { PrismaService } from "../database/prisma.service";
import { ContentValidatorService } from "./content-validator.service";
import { ContentSourceService } from "./content-source.service";
import type { EditContentDto } from "./dto/review-content.dto";

const contentInclude = Prisma.validator<Prisma.GeneratedContentInclude>()({
  generationJob: {
    include: {
      course: { include: { domain: true } },
      source: true,
      requestedBy: { select: { id: true, displayName: true } }
    }
  },
  microLesson: {
    include: {
      concept: true,
      misconception: true,
      slides: { orderBy: { order: "asc" } },
      quiz: true
    }
  },
  reviews: { orderBy: { createdAt: "asc" } }
});

type ContentRow = Prisma.GeneratedContentGetPayload<{ include: typeof contentInclude }>;

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

const allTeacherRoles = [ClassTeacherRole.OWNER, ClassTeacherRole.INSTRUCTOR, ClassTeacherRole.REVIEWER];

function teacherCourseAccess(
  userId: string,
  roles: ClassTeacherRole[] = allTeacherRoles
): Prisma.CourseWhereInput {
  return {
    status: "ACTIVE",
    deletedAt: null,
    organization: { status: "ACTIVE", deletedAt: null },
    enrollments: {
      some: {
        status: "ACTIVE",
        deletedAt: null,
        class: {
          status: "ACTIVE",
          deletedAt: null,
          OR: [
            { teacher: { userId, status: "ACTIVE", deletedAt: null } },
            {
              teacherMemberships: {
                some: {
                  teacher: { userId, status: "ACTIVE", deletedAt: null },
                  role: { in: roles },
                  status: "ACTIVE",
                  deletedAt: null
                }
              }
            }
          ]
        }
      }
    }
  };
}

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly local: LocalTemplateProvider,
    private readonly external: ExternalLlmProvider,
    private readonly validator: ContentValidatorService,
    private readonly sources: ContentSourceService
  ) {}

  async generate(input: GenerateContentDto, teacherUserId: string): Promise<GeneratedLearningContent & { reused: boolean; jobId: string }> {
    const verified = await this.sources.verifiedExcerpt(input.sourceId, teacherUserId);
    const concept = await this.prisma.learningConcept.findFirst({
      where: {
        code: input.conceptCode,
        domain: { code: input.domainCode },
        status: "ACTIVE",
        deletedAt: null,
        lessons: {
          some: {
            status: "ACTIVE",
            deletedAt: null,
            module: {
              course: {
                id: verified.source.courseId,
                ...teacherCourseAccess(teacherUserId, [ClassTeacherRole.OWNER, ClassTeacherRole.INSTRUCTOR])
              }
            }
          }
        }
      }
    });
    if (!concept) throw new BadRequestException("Concept is not registered in Supabase");
    const misconceptionCode = input.misconceptionCode?.trim();
    if (input.draftKind === "REMEDIATION" && !misconceptionCode) {
      throw new BadRequestException("Bài bổ trợ phải chọn một misconception thuộc concept đang dạy");
    }
    const misconception = input.draftKind === "REMEDIATION"
      ? await this.prisma.misconception.findFirst({
          where: {
            code: misconceptionCode!,
            conceptId: concept.id,
            status: "ACTIVE",
            deletedAt: null
          }
        })
      : null;
    if (input.draftKind === "REMEDIATION" && !misconception) {
      throw new BadRequestException("Misconception không tồn tại hoặc không thuộc concept đang dạy");
    }

    const reusable = input.draftKind === "REMEDIATION" ? await this.prisma.generatedContent.findFirst({
      where: {
        status: ContentStatus.PUBLISHED,
        generationJob: {
          requestedById: teacherUserId,
          courseId: verified.source.courseId
        },
        microLesson: {
          conceptId: concept.id,
          misconceptionId: misconception!.id,
          metadataJson: { path: ["draftKind"], equals: input.draftKind }
        }
      },
      include: contentInclude,
      orderBy: { updatedAt: "desc" }
    }) : null;
    if (reusable) {
      const updated = await this.prisma.generatedContent.update({
        where: { id: reusable.id },
        data: { reuseCount: { increment: 1 } },
        include: contentInclude
      });
      return { ...this.toDto(updated), reused: true, jobId: updated.generationJobId };
    }

    const promptVersion = input.provider === "EXTERNAL_LLM"
      ? "content-grounded-vi-v2"
      : "local-template-vi-v2";
    const groundingMode = input.provider === "EXTERNAL_LLM"
      ? "VERIFIED_EXCERPT_IN_PROMPT"
      : "VERIFIED_SOURCE_ATTACHED_TEMPLATE_NOT_INTERPRETED";
    const job = await this.prisma.aiGenerationJob.create({
      data: {
        courseId: verified.source.courseId,
        sourceId: verified.source.id,
        requestedById: teacherUserId,
        provider: input.provider,
        promptVersion,
        status: AiJobStatus.GENERATING,
        requestJson: json(input),
        contextJson: json({
          sourceChecksum: verified.source.checksum,
          sourceChars: verified.text.length,
          groundingMode
        })
      }
    });
    const provider = input.provider === "EXTERNAL_LLM" ? this.external : this.local;
    try {
      const output = await provider.generate(Object.assign(new GenerateContentDto(), input, { sourceExcerpt: verified.text }));
      this.validator.validate(output);
      const practiceQuestions = this.practiceQuestions(input.conceptCode, output.quiz);
      const row = await this.prisma.$transaction(async (tx) => {
        await tx.aiGenerationJob.update({
          where: { id: job.id },
          data: {
            status: AiJobStatus.VALIDATING,
            durationMs: output.generationMs,
            estimatedCostUsd: output.estimatedCostUsd,
            contextJson: json({
              sourceChecksum: verified.source.checksum,
              sourceChars: verified.text.length,
              groundingMode,
              generationTrace: output.trace ?? null
            })
          }
        });
        const created = await tx.generatedContent.create({
          data: {
            generationJobId: job.id,
            title: output.title,
            type: input.draftKind,
            status: ContentStatus.DRAFT,
            provider: output.provider,
            promptVersion,
            aiDraftJson: json(output),
            teacherVersionJson: json(output),
            educationalValidationJson: json({
              status: "PENDING_TEACHER_REVIEW",
              locale: "vi-VN",
              structuredSchemaPassed: true,
              humanReviewRequired: true
            }),
            codeValidationJson: json({
              status: "NOT_EXECUTED",
              structuredSchemaPassed: true,
              strategy: "registered-template-only"
            }),
            metadataJson: json({
              draftKind: input.draftKind,
              gradeBand: input.gradeBand,
              sections: output.sections,
              generationMs: output.generationMs,
              estimatedCostUsd: output.estimatedCostUsd,
              generationTrace: output.trace ?? null
            }),
            microLesson: {
              create: {
                conceptId: concept.id,
                misconceptionId: misconception?.id ?? null,
                title: output.title,
                level: input.level,
                objectivesJson: json(output.objectives),
                sourceReferencesJson: json(output.sourceReferences),
                durationMinutes: input.durationMinutes,
                animationTemplate: output.slides[0]?.animationTemplate ?? "CODE_HIGHLIGHT",
                status: ContentStatus.DRAFT,
                metadataJson: json({ draftKind: input.draftKind, gradeBand: input.gradeBand, sections: output.sections, practiceQuestions }),
                slides: {
                  create: output.slides.map((slide) => ({
                    order: slide.order,
                    type: slide.type as SlideType,
                    title: slide.title,
                    body: slide.body,
                    code: slide.code,
                    narration: slide.narration,
                    animationTemplate: slide.animationTemplate,
                    animationDataJson: json(slide.animationData)
                  }))
                },
                quiz: {
                  create: {
                    question: output.quiz.question,
                    optionsJson: json(output.quiz.options),
                    correctIndex: output.quiz.correctIndex,
                    explanation: output.quiz.explanation,
                    validationJson: { teacherReviewed: false, schemaPassed: true }
                  }
                }
              }
            },
            versions: {
              create: {
                version: 1,
                snapshotJson: json(output),
                changeSummary: `${output.provider} draft created from verified source`,
                createdById: teacherUserId
              }
            }
          },
          include: contentInclude
        });
        await tx.aiGenerationJob.update({
          where: { id: job.id },
          data: { status: AiJobStatus.COMPLETED, completedAt: new Date() }
        });
        await tx.auditLog.create({
          data: {
            actorId: teacherUserId,
            action: AuditAction.CREATE,
            entityType: "GeneratedContent",
            entityId: created.id,
            correlationId: job.id,
            afterJson: json({ status: created.status, sourceId: input.sourceId, provider: output.provider })
          }
        });
        return created;
      });
      return { ...this.toDto(row), reused: false, jobId: job.id };
    } catch (error) {
      await this.prisma.aiGenerationJob.update({
        where: { id: job.id },
        data: { status: AiJobStatus.FAILED, errorMessage: String(error).slice(0, 2_000), completedAt: new Date() }
      });
      throw error;
    }
  }

  async job(id: string, teacherUserId: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.aiGenerationJob.findFirst({
      where: { id, course: teacherCourseAccess(teacherUserId) },
      include: { generatedContent: { include: contentInclude } }
    });
    if (!row) throw new NotFoundException("AI generation job not found");
    return {
      id: row.id,
      status: row.status,
      provider: row.provider,
      durationMs: row.durationMs,
      estimatedCostUsd: row.estimatedCostUsd,
      errorMessage: row.errorMessage,
      content: row.generatedContent ? this.toDto(row.generatedContent) : null
    };
  }

  async listForTeacher(teacherUserId: string): Promise<GeneratedLearningContent[]> {
    const rows = await this.prisma.generatedContent.findMany({
      where: { generationJob: { course: teacherCourseAccess(teacherUserId) } },
      include: contentInclude,
      orderBy: { updatedAt: "desc" }
    });
    return rows.map((row) => this.toDto(row));
  }

  async listMisconceptions(conceptCode: string, teacherUserId: string): Promise<Array<Record<string, string>>> {
    const concept = await this.prisma.learningConcept.findFirst({
      where: {
        code: conceptCode,
        status: "ACTIVE",
        deletedAt: null,
        lessons: {
          some: {
            status: "ACTIVE",
            deletedAt: null,
            module: {
              course: {
                status: "ACTIVE",
                deletedAt: null,
                enrollments: {
                  some: {
                    class: {
                      status: "ACTIVE",
                      deletedAt: null,
                      OR: [
                        { teacher: { userId: teacherUserId } },
                        {
                          teacherMemberships: {
                            some: {
                              status: "ACTIVE",
                              deletedAt: null,
                              teacher: { userId: teacherUserId }
                            }
                          }
                        }
                      ]
                    }
                  }
                }
              }
            }
          }
        }
      },
      include: {
        misconceptions: {
          where: { status: "ACTIVE", deletedAt: null },
          orderBy: [{ severity: "desc" }, { title: "asc" }]
        }
      }
    });
    if (!concept) throw new NotFoundException("Không tìm thấy concept trong khóa học được phân công");
    return concept.misconceptions.map((item) => ({
      id: item.id,
      code: item.code,
      title: item.title,
      description: item.description,
      severity: item.severity
    }));
  }

  async getForTeacher(id: string, teacherUserId: string): Promise<GeneratedLearningContent> {
    return this.toDto(await this.contentRow(id, { teacherUserId }));
  }

  async getPublished(id: string, studentUserId: string): Promise<StudentPublishedLearningContent> {
    return this.toStudentDto(await this.publishedContentRow(id, studentUserId));
  }

  async edit(id: string, input: EditContentDto, teacherUserId: string): Promise<GeneratedLearningContent> {
    const existing = await this.contentRow(id, { teacherUserId, roles: [ClassTeacherRole.OWNER, ClassTeacherRole.INSTRUCTOR] });
    const immutableStatuses: ContentStatus[] = [ContentStatus.PUBLISHED, ContentStatus.ARCHIVED, ContentStatus.REJECTED];
    if (immutableStatuses.includes(existing.status)) {
      throw new BadRequestException("This status cannot be edited");
    }
    const dto = this.toDto(existing);
    if (input.title) dto.title = input.title;
    if (input.slides) {
      const edits = new Map(input.slides.map((slide) => [slide.id, slide]));
      dto.slides = dto.slides.map((slide) => {
        const edit = edits.get(slide.id);
        return edit ? { ...slide, title: edit.title, body: edit.body, narration: edit.narration } : slide;
      });
    }
    if (input.quiz) {
      if (input.quiz.correctIndex >= input.quiz.options.length) throw new BadRequestException("Quiz answer index is invalid");
      dto.quiz = { ...input.quiz };
    }
    this.validator.validate(this.providerOutput(dto));
    const existingMetadata = this.objectJson(existing.metadataJson);
    const nextVersion = existing.version + 1;
    const nextStatus = existing.status === ContentStatus.APPROVED
      ? ContentStatus.REVISION_REQUIRED
      : existing.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.generatedContent.update({
        where: { id },
        data: {
          title: dto.title,
          status: nextStatus,
          teacherVersionJson: json(this.providerOutput(dto)),
          version: nextVersion,
          teacherEditingSeconds: { increment: input.teacherEditingSeconds ?? 0 },
          metadataJson: json({ ...existingMetadata, lastEditedById: teacherUserId }),
          microLesson: { update: { title: dto.title, status: nextStatus, version: { increment: 1 } } },
          versions: {
            create: {
              version: nextVersion,
              snapshotJson: json(this.providerOutput(dto)),
              changeSummary: existing.status === ContentStatus.APPROVED
                ? "Teacher edited approved content; review required again"
                : "Teacher edited AI draft",
              createdById: teacherUserId
            }
          }
        }
      });
      for (const slide of dto.slides) {
        await tx.microLessonSlide.update({
          where: { id: slide.id },
          data: { title: slide.title, body: slide.body, narration: slide.narration, version: { increment: 1 } }
        });
      }
      if (!existing.microLesson?.quiz) throw new Error("Generated quiz is missing");
      await tx.generatedQuiz.update({
        where: { id: existing.microLesson.quiz.id },
        data: {
          question: dto.quiz.question,
          optionsJson: json(dto.quiz.options),
          correctIndex: dto.quiz.correctIndex,
          explanation: dto.quiz.explanation,
          version: { increment: 1 },
          validationJson: { teacherReviewed: true, schemaPassed: true }
        }
      });
      await tx.auditLog.create({
        data: {
          actorId: teacherUserId,
          action: AuditAction.UPDATE,
          entityType: "GeneratedContent",
          entityId: id,
          correlationId: randomUUID(),
          beforeJson: json({ version: existing.version, status: existing.status }),
          afterJson: json({
            version: nextVersion,
            status: nextStatus,
            teacherEditingSecondsAdded: input.teacherEditingSeconds ?? 0
          })
        }
      });
      return tx.generatedContent.findUniqueOrThrow({ where: { id }, include: contentInclude });
    });
    return this.toDto(updated);
  }

  submitReview(id: string, comment: string | undefined, teacherUserId: string): Promise<GeneratedLearningContent> {
    return this.transition(id, ContentStatus.IN_REVIEW, "SUBMIT_REVIEW", comment, [ContentStatus.DRAFT, ContentStatus.REVISION_REQUIRED], teacherUserId);
  }

  approve(id: string, comment: string | undefined, teacherUserId: string): Promise<GeneratedLearningContent> {
    return this.transition(id, ContentStatus.APPROVED, ReviewDecision.APPROVE, comment, [ContentStatus.IN_REVIEW], teacherUserId);
  }

  reject(id: string, comment: string | undefined, teacherUserId: string): Promise<GeneratedLearningContent> {
    return this.transition(id, ContentStatus.REJECTED, ReviewDecision.REJECT, comment, [ContentStatus.IN_REVIEW], teacherUserId);
  }

  requestRevision(id: string, comment: string | undefined, teacherUserId: string): Promise<GeneratedLearningContent> {
    return this.transition(id, ContentStatus.REVISION_REQUIRED, ReviewDecision.REQUEST_REVISION, comment, [ContentStatus.IN_REVIEW, ContentStatus.APPROVED], teacherUserId);
  }

  publish(id: string, comment: string | undefined, teacherUserId: string): Promise<GeneratedLearningContent> {
    return this.transition(id, ContentStatus.PUBLISHED, ReviewDecision.PUBLISH, comment, [ContentStatus.APPROVED], teacherUserId);
  }

  async completeQuiz(id: string, selectedIndex: number, studentUserId: string, questionIndex = 0): Promise<Record<string, unknown>> {
    const content = await this.publishedContentRow(id, studentUserId);
    if (!content.microLesson?.quiz) throw new NotFoundException("Published quiz not found");
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId: studentUserId, status: "ACTIVE", deletedAt: null }
    });
    if (!profile) throw new NotFoundException("Student profile not found");
    const metadata = this.objectJson(content.microLesson.metadataJson);
    const questions = this.quizArray(metadata.practiceQuestions);
    const selectedQuestion = questions[questionIndex] ?? {
      question: content.microLesson.quiz.question,
      options: this.stringArray(content.microLesson.quiz.optionsJson),
      correctIndex: content.microLesson.quiz.correctIndex,
      explanation: content.microLesson.quiz.explanation
    };
    const correct = selectedIndex === selectedQuestion.correctIndex;
    const state = await this.prisma.studentConceptState.findUnique({
      where: { studentProfileId_conceptId: { studentProfileId: profile.id, conceptId: content.microLesson.conceptId } }
    });
    const before = state?.mastery ?? 0.3;
    const after = Number(Math.max(0.02, Math.min(0.98, before + (correct ? 0.14 : -0.04))).toFixed(4));
    const xp = correct ? 40 : 12;
    await this.prisma.$transaction([
      this.prisma.studentConceptState.upsert({
        where: { studentProfileId_conceptId: { studentProfileId: profile.id, conceptId: content.microLesson.conceptId } },
        update: { mastery: after, modelVersion: "micro-lesson-quiz-v1", version: { increment: 1 }, lastPracticedAt: new Date() },
        create: {
          studentProfileId: profile.id,
          conceptId: content.microLesson.conceptId,
          mastery: after,
          stability: correct ? 5 : 1,
          retrievability: after,
          forgettingRisk: 1 - after,
          modelVersion: "micro-lesson-quiz-v1",
          lastPracticedAt: new Date()
        }
      }),
      this.prisma.studentProfile.update({ where: { id: profile.id }, data: { xp: { increment: xp } } }),
      this.prisma.xpEvent.create({
        data: { userId: studentUserId, amount: xp, reason: "Hoàn thành micro-lesson", sourceType: "MICRO_LESSON", sourceId: id }
      }),
      this.prisma.conceptStateHistory.create({
        data: {
          studentProfileId: profile.id,
          conceptId: content.microLesson.conceptId,
          mastery: after,
          stability: correct ? 5 : 1,
          retrievability: after,
          forgettingRisk: 1 - after,
          modelVersion: "micro-lesson-quiz-v1",
          metadataJson: json({ contentId: id, correct })
        }
      })
    ]);
    return {
      correct,
      explanation: selectedQuestion.explanation,
      questionIndex,
      totalQuestions: questions.length || 1,
      masteryBefore: before,
      masteryAfter: after,
      nextReviewIntervalDays: correct ? 5 : 1,
      xpEarned: xp
    };
  }

  private async transition(
    id: string,
    to: ContentStatus,
    action: ReviewDecision | "SUBMIT_REVIEW",
    comment: string | undefined,
    allowed: ContentStatus[],
    teacherUserId: string
  ): Promise<GeneratedLearningContent> {
    const reviewAction = action !== "SUBMIT_REVIEW";
    const roles = reviewAction
      ? [ClassTeacherRole.OWNER, ClassTeacherRole.REVIEWER]
      : [ClassTeacherRole.OWNER, ClassTeacherRole.INSTRUCTOR];
    const existing = await this.contentRow(id, { teacherUserId, roles });
    const metadata = this.objectJson(existing.metadataJson);
    const lastEditedById = typeof metadata.lastEditedById === "string" ? metadata.lastEditedById : null;
    if (
      reviewAction
      && (existing.generationJob.requestedById === teacherUserId || lastEditedById === teacherUserId)
    ) {
      throw new BadRequestException("Người tạo bản nháp không thể tự duyệt hoặc xuất bản nội dung của mình");
    }
    if (!allowed.includes(existing.status)) throw new BadRequestException(`Cannot ${action} content from ${existing.status}`);
    const nextVersion = existing.version + 1;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.generatedContent.update({
        where: { id },
        data: {
          status: to,
          version: nextVersion,
          ...(to === ContentStatus.PUBLISHED ? { publishedAt: new Date() } : {}),
          microLesson: { update: { status: to, version: { increment: 1 } } },
          versions: {
            create: {
              version: nextVersion,
              snapshotJson: json(this.toDto(existing)),
              changeSummary: `${action}: ${existing.status} -> ${to}`,
              createdById: teacherUserId
            }
          }
        }
      });
      if (action !== "SUBMIT_REVIEW") {
        await tx.contentReview.create({
          data: {
            generatedContentId: id,
            reviewerId: teacherUserId,
            decision: action,
            comment,
            fromStatus: existing.status,
            toStatus: to,
            diffJson: json({ status: { from: existing.status, to } })
          }
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: teacherUserId,
          action: action === ReviewDecision.PUBLISH ? AuditAction.PUBLISH : action === ReviewDecision.APPROVE ? AuditAction.APPROVE : action === ReviewDecision.REJECT ? AuditAction.REJECT : AuditAction.UPDATE,
          entityType: "GeneratedContent",
          entityId: id,
          correlationId: randomUUID(),
          beforeJson: json({ status: existing.status }),
          afterJson: json({ status: to, comment })
        }
      });
      return tx.generatedContent.findUniqueOrThrow({ where: { id }, include: contentInclude });
    });
    return this.toDto(updated);
  }

  private async contentRow(id: string, options: { teacherUserId: string; roles?: ClassTeacherRole[] }): Promise<ContentRow> {
    const row = await this.prisma.generatedContent.findFirst({
      where: {
        OR: [{ id }, { microLesson: { id } }],
        generationJob: { course: teacherCourseAccess(options.teacherUserId, options.roles) }
      },
      include: contentInclude
    });
    if (!row) throw new NotFoundException("Generated content not found");
    return row;
  }

  private async publishedContentRow(id: string, studentUserId: string): Promise<ContentRow> {
    const row = await this.prisma.generatedContent.findFirst({
      where: {
        OR: [{ id }, { microLesson: { id } }],
        status: ContentStatus.PUBLISHED,
        microLesson: { status: ContentStatus.PUBLISHED },
        generationJob: {
          course: {
            status: "ACTIVE",
            deletedAt: null,
            organization: { status: "ACTIVE", deletedAt: null },
            enrollments: {
              some: {
                status: "ACTIVE",
                deletedAt: null,
                class: { status: "ACTIVE", deletedAt: null },
                student: {
                  userId: studentUserId,
                  status: "ACTIVE",
                  deletedAt: null
                }
              }
            }
          }
        }
      },
      include: contentInclude
    });
    if (!row) throw new NotFoundException("Published micro-lesson not found");
    return row;
  }

  private toDto(row: ContentRow): GeneratedLearningContent {
    if (!row.microLesson?.quiz) throw new Error(`Generated content ${row.id} has no complete micro-lesson`);
    const metadata = this.objectJson(row.metadataJson);
    const lessonMetadata = this.objectJson(row.microLesson.metadataJson);
    const traceMetadata = this.objectJson(metadata.generationTrace ?? {});
    const generationTrace =
      typeof traceMetadata.model === "string" &&
      typeof traceMetadata.promptTokens === "number" &&
      typeof traceMetadata.completionTokens === "number" &&
      typeof traceMetadata.promptHash === "string"
        ? {
            model: traceMetadata.model,
            promptTokens: traceMetadata.promptTokens,
            completionTokens: traceMetadata.completionTokens,
            promptHash: traceMetadata.promptHash
          }
        : undefined;
    return {
      id: row.id,
      title: row.title,
      domainCode: row.generationJob.course.domain.code,
      conceptCode: row.microLesson.concept.code,
      misconceptionCode: row.microLesson.misconception?.code ?? "UNKNOWN",
      level: row.microLesson.level,
      objectives: this.stringArray(row.microLesson.objectivesJson),
      sourceReferences: this.stringArray(row.microLesson.sourceReferencesJson),
      slides: row.microLesson.slides.map((slide) => ({
        id: slide.id,
        order: slide.order,
        type: slide.type,
        title: slide.title,
        body: slide.body,
        ...(slide.code ? { code: slide.code } : {}),
        narration: slide.narration,
        animationTemplate: slide.animationTemplate,
        animationData: this.objectJson(slide.animationDataJson) as Record<string, string | number | string[]>
      })),
      quiz: {
        question: row.microLesson.quiz.question,
        options: this.stringArray(row.microLesson.quiz.optionsJson),
        correctIndex: row.microLesson.quiz.correctIndex,
        explanation: row.microLesson.quiz.explanation
      },
      practiceQuestions: this.quizArray(lessonMetadata.practiceQuestions),
      status: row.status,
      provider: row.provider as GeneratedLearningContent["provider"],
      reuseCount: row.reuseCount,
      version: row.version,
      generationMs: typeof metadata.generationMs === "number" ? metadata.generationMs : row.generationJob.durationMs ?? 0,
      teacherEditingSeconds: row.teacherEditingSeconds,
      estimatedCostUsd: typeof metadata.estimatedCostUsd === "number" ? metadata.estimatedCostUsd : row.generationJob.estimatedCostUsd,
      requestedBy: row.generationJob.requestedBy,
      ...(generationTrace ? { generationTrace } : {}),
      reviewHistory: row.reviews.map((review) => ({
        action: review.decision,
        from: review.fromStatus,
        to: review.toStatus,
        at: review.createdAt.toISOString(),
        ...(review.comment ? { comment: review.comment } : {})
      })),
      updatedAt: row.updatedAt.toISOString(),
      draftKind: row.type as GeneratedLearningContent["draftKind"],
      gradeBand: typeof lessonMetadata.gradeBand === "string" ? lessonMetadata.gradeBand : undefined,
      totalDurationMinutes: row.microLesson.durationMinutes,
      sections: Array.isArray(lessonMetadata.sections) ? lessonMetadata.sections as GeneratedLearningContent["sections"] : []
    };
  }

  private toStudentDto(row: ContentRow): StudentPublishedLearningContent {
    const content = this.toDto(row);
    return {
      id: content.id,
      title: content.title,
      domainCode: content.domainCode,
      conceptCode: content.conceptCode,
      level: content.level,
      objectives: content.objectives,
      sourceReferences: content.sourceReferences,
      slides: content.slides,
      quiz: {
        question: content.quiz.question,
        options: content.quiz.options
      },
      practiceQuestions: (content.practiceQuestions ?? []).map((question) => ({
        question: question.question,
        options: question.options
      })),
      status: "PUBLISHED",
      version: content.version,
      updatedAt: content.updatedAt,
      ...(content.draftKind ? { draftKind: content.draftKind } : {}),
      ...(content.gradeBand ? { gradeBand: content.gradeBand } : {}),
      ...(content.totalDurationMinutes === undefined ? {} : { totalDurationMinutes: content.totalDurationMinutes }),
      ...(content.sections ? { sections: content.sections } : {})
    };
  }

  private providerOutput(content: GeneratedLearningContent): ProviderOutput {
    return {
      title: content.title,
      objectives: content.objectives,
      sourceReferences: content.sourceReferences,
      slides: content.slides,
      quiz: content.quiz,
      provider: content.provider,
      generationMs: content.generationMs,
      estimatedCostUsd: content.estimatedCostUsd,
      trace: content.generationTrace,
      sections: content.sections ?? []
    };
  }

  private stringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  }

  private objectJson(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
    return value && !Array.isArray(value) && typeof value === "object"
      ? (value as Record<string, Prisma.JsonValue>)
      : {};
  }

  private quizArray(value: Prisma.JsonValue | undefined): Array<{ question: string; options: string[]; correctIndex: number; explanation: string }> {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || Array.isArray(item) || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const options = Array.isArray(row.options) ? row.options.filter((entry): entry is string => typeof entry === "string") : [];
      if (typeof row.question !== "string" || typeof row.correctIndex !== "number" || typeof row.explanation !== "string" || options.length < 2) return [];
      return [{ question: row.question, options, correctIndex: row.correctIndex, explanation: row.explanation }];
    });
  }

  private practiceQuestions(conceptCode: string, primary: ProviderOutput["quiz"]): ProviderOutput["quiz"][] {
    if (conceptCode !== "PYTHON_RANGE") return [primary];
    return [
      primary,
      {
        question: "Dãy nào được tạo bởi list(range(2, 6))?",
        options: ["[2, 3, 4, 5]", "[2, 3, 4, 5, 6]", "[1, 2, 3, 4, 5]", "[2, 6]"],
        correctIndex: 0,
        explanation: "range bắt đầu ở 2 và dừng ngay trước 6, nên giá trị cuối là 5."
      },
      {
        question: "Kết quả của list(range(0, 7, 2)) là gì?",
        options: ["[0, 2, 4, 6]", "[0, 2, 4, 6, 8]", "[2, 4, 6]", "[0, 1, 2, 3, 4, 5, 6]"],
        correctIndex: 0,
        explanation: "Dãy đi từ 0, tăng mỗi lần 2 và dừng trước 7."
      }
    ];
  }
}
