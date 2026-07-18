import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";

export type SourceStatus = "PENDING_EXTRACTION" | "NEEDS_REVIEW" | "VERIFIED";

export interface ContentSourceRecord {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  status: SourceStatus;
  extractedPreview: string;
  createdAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

const handbookExcerpt = [
  "range(start, stop, step) tạo một dãy số. Giá trị start được lấy, còn stop không thuộc dãy.",
  "Khi step dương, giá trị tiếp theo phải nhỏ hơn stop. Khi step âm, giá trị tiếp theo phải lớn hơn stop.",
  "Ví dụ list(range(1, 5)) là [1, 2, 3, 4]. Muốn lấy cả 5, dùng range(1, 6).",
  "Khi dạy học sinh mới bắt đầu, nên cho các em dự đoán dãy, chạy code và giải thích lỗi lệch một đơn vị."
].join("\n");

@Injectable()
export class ContentSourceService {
  private readonly sources = new Map<string, ContentSourceRecord>();

  constructor() {
    const now = new Date().toISOString();
    this.sources.set("source-python-handbook-01", {
      id: "source-python-handbook-01",
      name: "Python handbook nội bộ · bản 1.3.txt",
      mimeType: "text/plain",
      sizeBytes: Buffer.byteLength(handbookExcerpt),
      checksum: createHash("sha256").update(handbookExcerpt).digest("hex"),
      status: "VERIFIED",
      extractedPreview: handbookExcerpt,
      createdAt: now,
      verifiedAt: now,
      verifiedBy: "teacher-mai"
    });
  }

  add(file: Express.Multer.File): ContentSourceRecord {
    const isPlainText = file.mimetype === "text/plain";
    const preview = isPlainText
      ? file.buffer.toString("utf8").replace(/\0/g, "").trim().slice(0, 12_000)
      : "Tài liệu nhị phân đã qua kiểm tra MIME và checksum; cần worker tách văn bản trước khi dùng để sinh bài.";
    if (isPlainText && preview.length < 40) throw new BadRequestException("Tài liệu văn bản quá ngắn để làm nguồn bài học");
    const source: ContentSourceRecord = {
      id: randomUUID(),
      name: file.originalname.replace(/[<>:"/\\|?*]/g, "_"),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      checksum: createHash("sha256").update(file.buffer).digest("hex"),
      status: isPlainText ? "NEEDS_REVIEW" : "PENDING_EXTRACTION",
      extractedPreview: preview,
      createdAt: new Date().toISOString()
    };
    this.sources.set(source.id, source);
    return source;
  }

  list(): ContentSourceRecord[] {
    return [...this.sources.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  get(id: string): ContentSourceRecord {
    const source = this.sources.get(id);
    if (!source) throw new NotFoundException("Content source not found");
    return source;
  }

  verify(id: string, teacherId = "teacher-mai"): ContentSourceRecord {
    const source = this.get(id);
    if (source.status === "PENDING_EXTRACTION") throw new BadRequestException("Source text has not been extracted yet");
    source.status = "VERIFIED";
    source.verifiedAt = new Date().toISOString();
    source.verifiedBy = teacherId;
    this.sources.set(id, source);
    return source;
  }

  verifiedExcerpt(id: string): string {
    const source = this.get(id);
    if (source.status !== "VERIFIED") throw new BadRequestException("Source must be reviewed before AI generation");
    return source.extractedPreview;
  }
}
