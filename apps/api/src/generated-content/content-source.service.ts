import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ContentSourceStatus, ContentSourceType, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../database/prisma.service";

export interface ContentSourceRecord {
  id: string;
  courseId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  status: ContentSourceStatus;
  extractedPreview: string;
  createdAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

@Injectable()
export class ContentSourceService {
  constructor(private readonly prisma: PrismaService) {}

  async add(file: Express.Multer.File, teacherUserId: string): Promise<ContentSourceRecord> {
    const isPlainText = file.mimetype === "text/plain";
    if (!isPlainText) {
      throw new BadRequestException(
        "Pilot hiện nhận TXT để lưu và kiểm duyệt trực tiếp trên Supabase. PDF/DOCX/PPTX cần cấu hình Supabase Storage và worker trích xuất trước khi bật."
      );
    }
    const extractedText = file.buffer.toString("utf8").replace(/\0/g, "").trim().slice(0, 200_000);
    if (extractedText.length < 40) throw new BadRequestException("Tài liệu văn bản quá ngắn để làm nguồn bài học");
    const course = await this.teacherCourse(teacherUserId);
    const checksum = createHash("sha256").update(file.buffer).digest("hex");
    const existing = await this.prisma.contentSource.findUnique({
      where: { courseId_checksum: { courseId: course.id, checksum } }
    });
    if (existing) return this.toRecord(existing);
    const source = await this.prisma.contentSource.create({
      data: {
        courseId: course.id,
        uploadedById: teacherUserId,
        name: file.originalname.replace(/[<>:"/\\|?*]/g, "_"),
        type: ContentSourceType.TXT,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        checksum,
        extractedText,
        status: ContentSourceStatus.NEEDS_REVIEW,
        metadataJson: { extraction: "DIRECT_UTF8", locale: "vi-VN" },
        chunks: {
          create: this.chunk(extractedText).map((text, chunkIndex) => ({
            chunkIndex,
            text,
            tokenCount: Math.ceil(text.length / 4),
            metadataJson: { strategy: "paragraph-window-v1" }
          }))
        }
      }
    });
    return this.toRecord(source);
  }

  async list(teacherUserId: string): Promise<ContentSourceRecord[]> {
    const course = await this.teacherCourse(teacherUserId);
    const rows = await this.prisma.contentSource.findMany({
      where: { courseId: course.id, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((row) => this.toRecord(row));
  }

  async get(id: string, teacherUserId?: string): Promise<ContentSourceRecord> {
    const row = await this.sourceRow(id, teacherUserId);
    return this.toRecord(row);
  }

  async verify(id: string, teacherUserId: string): Promise<ContentSourceRecord> {
    const source = await this.sourceRow(id, teacherUserId);
    if (source.status === ContentSourceStatus.PENDING_EXTRACTION) {
      throw new BadRequestException("Source text has not been extracted yet");
    }
    const metadata = this.objectJson(source.metadataJson);
    const updated = await this.prisma.contentSource.update({
      where: { id },
      data: {
        status: ContentSourceStatus.VERIFIED,
        verifiedAt: new Date(),
        metadataJson: { ...metadata, verifiedBy: teacherUserId }
      }
    });
    return this.toRecord(updated);
  }

  async verifiedExcerpt(id: string, teacherUserId: string): Promise<{ source: ContentSourceRecord; text: string }> {
    const row = await this.sourceRow(id, teacherUserId);
    if (row.status !== ContentSourceStatus.VERIFIED || !row.extractedText) {
      throw new BadRequestException("Source must be reviewed before AI generation");
    }
    return { source: this.toRecord(row), text: row.extractedText.slice(0, 24_000) };
  }

  private async sourceRow(id: string, teacherUserId?: string) {
    const row = await this.prisma.contentSource.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(teacherUserId ? { course: { enrollments: { some: { class: { teacher: { userId: teacherUserId } } } } } } : {})
      }
    });
    if (!row) throw new NotFoundException("Content source not found");
    return row;
  }

  private async teacherCourse(teacherUserId: string) {
    const course = await this.prisma.course.findFirst({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        enrollments: { some: { class: { teacher: { userId: teacherUserId }, status: "ACTIVE", deletedAt: null } } }
      },
      orderBy: { createdAt: "asc" }
    });
    if (!course) throw new NotFoundException("Giảng viên chưa được phân công khóa học đang hoạt động");
    return course;
  }

  private toRecord(source: {
    id: string;
    courseId: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    checksum: string;
    status: ContentSourceStatus;
    extractedText: string | null;
    createdAt: Date;
    verifiedAt: Date | null;
    metadataJson: Prisma.JsonValue;
  }): ContentSourceRecord {
    const metadata = this.objectJson(source.metadataJson);
    return {
      id: source.id,
      courseId: source.courseId,
      name: source.name,
      mimeType: source.mimeType,
      sizeBytes: source.sizeBytes,
      checksum: source.checksum,
      status: source.status,
      extractedPreview: source.extractedText?.slice(0, 12_000) ?? "",
      createdAt: source.createdAt.toISOString(),
      ...(source.verifiedAt ? { verifiedAt: source.verifiedAt.toISOString() } : {}),
      ...(typeof metadata.verifiedBy === "string" ? { verifiedBy: metadata.verifiedBy } : {})
    };
  }

  private chunk(text: string): string[] {
    const paragraphs = text.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
    const chunks: string[] = [];
    let current = "";
    for (const paragraph of paragraphs) {
      if (current && current.length + paragraph.length > 2_000) {
        chunks.push(current);
        current = "";
      }
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
    if (current) chunks.push(current);
    return chunks.length ? chunks : [text.slice(0, 2_000)];
  }

  private objectJson(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
    return value && !Array.isArray(value) && typeof value === "object"
      ? (value as Record<string, Prisma.JsonValue>)
      : {};
  }
}
