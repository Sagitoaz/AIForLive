import { BadRequestException } from "@nestjs/common";
import { ClassTeacherRole, ContentSourceStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { ContentSourceService } from "./content-source.service";

function serviceHarness() {
  const prisma = {
    course: { findFirst: jest.fn() },
    contentSource: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  };
  return {
    prisma,
    service: new ContentSourceService(prisma as unknown as PrismaService)
  };
}

describe("ContentSourceService teacher assignment boundaries", () => {
  const textFile = {
    mimetype: "text/plain",
    buffer: Buffer.from("Nguồn học liệu đủ dài để giảng viên xem trước và xác minh trước khi tạo bài."),
    originalname: "range.txt",
    size: 82
  } as Express.Multer.File;

  it("rejects an ambiguous upload that does not name its target course", async () => {
    const test = serviceHarness();

    await expect(test.service.add(textFile, "teacher-2")).rejects.toBeInstanceOf(BadRequestException);
    expect(test.prisma.course.findFirst).not.toHaveBeenCalled();
  });

  it("allows only an assigned author role to upload into the selected course", async () => {
    const test = serviceHarness();
    test.prisma.course.findFirst.mockResolvedValue({ id: "course-1" });
    test.prisma.contentSource.findUnique.mockResolvedValue(null);
    test.prisma.contentSource.create.mockResolvedValue({
      id: "source-1",
      courseId: "course-1",
      name: "range.txt",
      mimeType: "text/plain",
      sizeBytes: 82,
      checksum: "checksum-1",
      status: ContentSourceStatus.NEEDS_REVIEW,
      extractedText: textFile.buffer.toString("utf8"),
      createdAt: new Date(0),
      verifiedAt: null,
      metadataJson: {}
    });

    await expect(test.service.add(textFile, "teacher-2", "course-1")).resolves.toMatchObject({
      id: "source-1",
      courseId: "course-1"
    });
    expect(test.prisma.course.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "course-1",
        enrollments: {
          some: expect.objectContaining({
            class: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  teacherMemberships: {
                    some: expect.objectContaining({
                      role: { in: [ClassTeacherRole.OWNER, ClassTeacherRole.INSTRUCTOR] }
                    })
                  }
                })
              ])
            })
          })
        }
      })
    }));
  });

  it("lists sources only from an explicitly selected assigned course", async () => {
    const test = serviceHarness();

    await expect(test.service.list("teacher-2", "course-1")).resolves.toEqual([]);

    expect(test.prisma.contentSource.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        deletedAt: null,
        course: expect.objectContaining({
          id: "course-1",
          enrollments: {
            some: expect.objectContaining({
              class: expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({ teacherMemberships: expect.any(Object) })
                ])
              })
            })
          }
        })
      }
    }));
  });

  it("scopes a source read to active enrollment and active teacher membership", async () => {
    const test = serviceHarness();
    test.prisma.contentSource.findFirst.mockResolvedValue({
      id: "source-1",
      courseId: "course-1",
      name: "lesson.txt",
      mimeType: "text/plain",
      sizeBytes: 128,
      checksum: "checksum-1",
      status: ContentSourceStatus.NEEDS_REVIEW,
      extractedText: "Nội dung đã trích xuất để giáo viên xem trước và xác minh.",
      createdAt: new Date(0),
      verifiedAt: null,
      metadataJson: {}
    });

    await expect(test.service.get("source-1", "teacher-2")).resolves.toMatchObject({
      id: "source-1",
      status: ContentSourceStatus.NEEDS_REVIEW
    });

    expect(test.prisma.contentSource.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "source-1",
        course: expect.objectContaining({
          enrollments: {
            some: expect.objectContaining({
              status: "ACTIVE",
              deletedAt: null,
              class: expect.objectContaining({
                status: "ACTIVE",
                deletedAt: null,
                OR: expect.arrayContaining([
                  expect.objectContaining({ teacherMemberships: expect.any(Object) })
                ])
              })
            })
          }
        })
      })
    });
  });
});
