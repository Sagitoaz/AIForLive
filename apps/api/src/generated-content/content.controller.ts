import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { GenerateContentDto } from "../ai-generation/dto/generate-content.dto";
import { ContentSourceService } from "./content-source.service";
import { ContentService } from "./content.service";
import { EditContentDto, ReviewActionDto } from "./dto/review-content.dto";

const allowedMime = new Set([
  "text/plain",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);

@ApiTags("content")
@Controller()
export class ContentController {
  constructor(private readonly content: ContentService, private readonly sources: ContentSourceService) {}

  @Post("content-sources/upload")
  @ApiBearerAuth()
  @Roles("TEACHER")
  @UseGuards(AuthGuard, RolesGuard)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file || !allowedMime.has(file.mimetype)) throw new BadRequestException("Only TXT, PDF, DOCX and PPTX are accepted");
    return this.sources.add(file);
  }

  @Get("content-sources")
  @ApiBearerAuth()
  @Roles("TEACHER")
  @UseGuards(AuthGuard, RolesGuard)
  sourcesList() {
    return this.sources.list();
  }

  @Get("content-sources/:id")
  @ApiBearerAuth()
  @Roles("TEACHER")
  @UseGuards(AuthGuard, RolesGuard)
  source(@Param("id") id: string) {
    return this.sources.get(id);
  }

  @Post("content-sources/:id/verify")
  @ApiBearerAuth()
  @Roles("TEACHER")
  @UseGuards(AuthGuard, RolesGuard)
  verifySource(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.sources.verify(id, request.user.id);
  }

  @Post("ai/content/generate")
  @ApiBearerAuth()
  @Roles("TEACHER")
  @UseGuards(AuthGuard, RolesGuard)
  generate(@Body() body: GenerateContentDto) {
    return this.content.generate(body);
  }

  @Get("ai/jobs/:id")
  @ApiBearerAuth()
  @Roles("TEACHER")
  @UseGuards(AuthGuard, RolesGuard)
  job(@Param("id") id: string) {
    const item = this.content.getForTeacher(id);
    return { id, status: "COMPLETED", provider: item.provider, content: item };
  }

  @Get("teacher/reviews")
  @ApiBearerAuth()
  @Roles("TEACHER")
  @UseGuards(AuthGuard, RolesGuard)
  reviews() {
    return this.content.listForTeacher();
  }

  @Get("teacher/generated-content/:id")
  @ApiBearerAuth()
  @Roles("TEACHER")
  @UseGuards(AuthGuard, RolesGuard)
  teacherContent(@Param("id") id: string) {
    return this.content.getForTeacher(id);
  }

  @Patch("teacher/generated-content/:id")
  @ApiBearerAuth()
  @Roles("TEACHER")
  @UseGuards(AuthGuard, RolesGuard)
  edit(@Param("id") id: string, @Body() body: EditContentDto) {
    return this.content.edit(id, body);
  }

  @Post("teacher/generated-content/:id/review")
  @ApiBearerAuth()
  @Roles("TEACHER")
  @UseGuards(AuthGuard, RolesGuard)
  review(@Param("id") id: string, @Body() body: ReviewActionDto) {
    return this.content.submitReview(id, body.comment);
  }

  @Post("teacher/generated-content/:id/approve")
  @ApiBearerAuth()
  @Roles("TEACHER")
  @UseGuards(AuthGuard, RolesGuard)
  approve(@Param("id") id: string, @Body() body: ReviewActionDto) {
    return this.content.approve(id, body.comment);
  }

  @Post("teacher/generated-content/:id/reject")
  @ApiBearerAuth()
  @Roles("TEACHER")
  @UseGuards(AuthGuard, RolesGuard)
  reject(@Param("id") id: string, @Body() body: ReviewActionDto) {
    return this.content.reject(id, body.comment);
  }

  @Post("teacher/generated-content/:id/revision")
  @ApiBearerAuth()
  @Roles("TEACHER")
  @UseGuards(AuthGuard, RolesGuard)
  revision(@Param("id") id: string, @Body() body: ReviewActionDto) {
    return this.content.requestRevision(id, body.comment);
  }

  @Post("teacher/generated-content/:id/publish")
  @ApiBearerAuth()
  @Roles("TEACHER")
  @UseGuards(AuthGuard, RolesGuard)
  publish(@Param("id") id: string, @Body() body: ReviewActionDto) {
    return this.content.publish(id, body.comment);
  }

  @Get("micro-lessons/:id")
  @ApiBearerAuth()
  @Roles("STUDENT")
  @UseGuards(AuthGuard, RolesGuard)
  microLesson(@Param("id") id: string) {
    return this.content.getPublished(id);
  }

  @Post("micro-lessons/:id/start")
  @ApiBearerAuth()
  @Roles("STUDENT")
  @UseGuards(AuthGuard, RolesGuard)
  start(@Param("id") id: string): Record<string, unknown> {
    this.content.getPublished(id);
    return { id, status: "STARTED", startedAt: new Date().toISOString() };
  }

  @Post("micro-lessons/:id/quiz")
  @ApiBearerAuth()
  @Roles("STUDENT")
  @UseGuards(AuthGuard, RolesGuard)
  quiz(@Param("id") id: string, @Body("selectedIndex", ParseIntPipe) selectedIndex: number) {
    return this.content.completeQuiz(id, selectedIndex);
  }

  @Post("micro-lessons/:id/complete")
  @ApiBearerAuth()
  @Roles("STUDENT")
  @UseGuards(AuthGuard, RolesGuard)
  complete(@Param("id") id: string): Record<string, unknown> {
    this.content.getPublished(id);
    return { id, status: "COMPLETED", completedAt: new Date().toISOString() };
  }
}
