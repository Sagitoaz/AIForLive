import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { createHash, randomUUID } from "node:crypto";
import { GenerateContentDto } from "../ai-generation/dto/generate-content.dto";
import { ContentService } from "./content.service";
import { LessonExportService } from "./lesson-export.service";
import { EditContentDto, ReviewActionDto } from "./dto/review-content.dto";
import type { LessonSectionType } from "../common/types";

const allowedMime = new Set([
  "text/plain",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);

@ApiTags("content")
@Controller()
export class ContentController {
  private readonly sources = new Map<string, Record<string, unknown>>();

  constructor(
    private readonly content: ContentService,
    private readonly exporter: LessonExportService
  ) {}

  @Post("content-sources/upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
  upload(@UploadedFile() file?: Express.Multer.File): Record<string, unknown> {
    if (!file || !allowedMime.has(file.mimetype)) throw new BadRequestException("Only TXT, PDF, DOCX and PPTX are accepted");
    const id = randomUUID();
    const source = {
      id,
      name: file.originalname.replace(/[<>:"/\\|?*]/g, "_"),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      checksum: createHash("sha256").update(file.buffer).digest("hex"),
      status: "EXTRACTED",
      extractedPreview: file.mimetype === "text/plain" ? file.buffer.toString("utf8").slice(0, 2_000) : "Binary document validated and queued for safe text extraction.",
      createdAt: new Date().toISOString()
    };
    this.sources.set(id, source);
    return source;
  }

  @Get("content-sources")
  sourcesList(): Record<string, unknown>[] {
    return [...this.sources.values()];
  }

  @Get("content-sources/:id")
  source(@Param("id") id: string): Record<string, unknown> {
    const source = this.sources.get(id);
    if (!source) throw new BadRequestException("Source not found");
    return source;
  }

  @Post("ai/content/generate")
  generate(@Body() body: GenerateContentDto) {
    return this.content.generate(body);
  }

  @Get("ai/jobs/:id")
  job(@Param("id") id: string) {
    const item = this.content.getForTeacher(id);
    return { id, status: "COMPLETED", provider: item.provider, content: item };
  }

  @Get("teacher/reviews")
  reviews() {
    return this.content.listForTeacher();
  }

  @Get("teacher/generated-content/:id")
  teacherContent(@Param("id") id: string) {
    return this.content.getForTeacher(id);
  }

  @Patch("teacher/generated-content/:id")
  edit(@Param("id") id: string, @Body() body: EditContentDto) {
    return this.content.edit(id, body);
  }

  @Post("teacher/generated-content/:id/review")
  review(@Param("id") id: string, @Body() body: ReviewActionDto) {
    return this.content.submitReview(id, body.comment);
  }

  @Post("teacher/generated-content/:id/approve")
  approve(@Param("id") id: string, @Body() body: ReviewActionDto) {
    return this.content.approve(id, body.comment);
  }

  @Post("teacher/generated-content/:id/reject")
  reject(@Param("id") id: string, @Body() body: ReviewActionDto) {
    return this.content.reject(id, body.comment);
  }

  @Post("teacher/generated-content/:id/revision")
  revision(@Param("id") id: string, @Body() body: ReviewActionDto) {
    return this.content.requestRevision(id, body.comment);
  }

  @Post("teacher/generated-content/:id/publish")
  publish(@Param("id") id: string, @Body() body: ReviewActionDto) {
    return this.content.publish(id, body.comment);
  }

  @Get("micro-lessons/:id")
  microLesson(@Param("id") id: string) {
    return this.content.getPublished(id);
  }

  @Post("micro-lessons/:id/start")
  start(@Param("id") id: string): Record<string, unknown> {
    this.content.getPublished(id);
    return { id, status: "STARTED", startedAt: new Date().toISOString() };
  }

  @Post("micro-lessons/:id/quiz")
  quiz(@Param("id") id: string, @Body("selectedIndex", ParseIntPipe) selectedIndex: number) {
    return this.content.completeQuiz(id, selectedIndex);
  }

  @Post("micro-lessons/:id/complete")
  complete(@Param("id") id: string): Record<string, unknown> {
    this.content.getPublished(id);
    return { id, status: "COMPLETED", completedAt: new Date().toISOString() };
  }

  /* FEATURE-016 — three-part lesson endpoints */

  @Get("micro-lessons/:id/sections")
  sections(@Param("id") id: string) {
    this.content.getPublished(id);
    return this.content.getSections(id);
  }

  @Get("micro-lessons/:id/progress")
  progress(@Param("id") id: string, @Body("studentId") studentId?: string) {
    return this.content.lessonProgress(id, studentId ?? "student-minh");
  }

  @Post("micro-lessons/:id/sections/:type/progress")
  sectionProgress(
    @Param("id") id: string,
    @Param("type") type: LessonSectionType,
    @Body() body: { progressPercent?: number; completed?: boolean; studentId?: string }
  ) {
    return this.content.recordSectionProgress(id, type, body ?? {});
  }

  @Post("micro-lessons/:id/final-assessment")
  finalAssessment(
    @Param("id") id: string,
    @Body() body: { answers?: Array<{ questionId: string; selectedIndex?: number; answer?: string }>; studentId?: string }
  ) {
    if (!body?.answers || !Array.isArray(body.answers)) {
      throw new BadRequestException("answers array is required");
    }
    return this.content.submitFinalAssessment(id, body.answers, body.studentId ?? "student-minh");
  }

  @Get("teacher/generated-content/:id/sections")
  teacherSections(@Param("id") id: string) {
    return this.content.getSections(id);
  }

  @Post("export")
  export(@Body("contentId") contentId: string): Record<string, unknown> {
    if (!contentId) throw new BadRequestException("contentId is required");
    const content = this.content.getForTeacher(contentId);
    const { filename, html } = this.exporter.build(content);
    return { filename, sizeBytes: Buffer.byteLength(html, "utf8"), contentType: "text/html", html };
  }
}
