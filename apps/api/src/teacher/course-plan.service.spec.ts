import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CoursePlanService } from "./course-plan.service";

describe("CoursePlanService co-teacher authorization", () => {
  it("scopes the catalog to a course actively assigned through a class membership", async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: "course-1", modules: [{ lessons: [{ id: "lesson-1" }] }] });
    const service = new CoursePlanService({ course: { findFirst } } as unknown as PrismaService);
    const internals = service as unknown as { catalog(courseId: string, teacherId: string): Promise<unknown> };

    await internals.catalog("course-1", "teacher-user-2");

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        enrollments: {
          some: expect.objectContaining({
            status: "ACTIVE",
            deletedAt: null,
            class: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({ teacherMemberships: expect.any(Object) })
              ])
            })
          })
        }
      })
    }));
    const membership = findFirst.mock.calls[0]?.[0].where.enrollments.some.class.OR
      .find((item: { teacherMemberships?: unknown }) => item.teacherMemberships)?.teacherMemberships;
    expect(membership).toEqual(expect.objectContaining({
      some: expect.objectContaining({ role: { in: ["OWNER", "INSTRUCTOR"] } })
    }));
  });

  it("accepts an active, non-deleted co-teacher membership for a selected class", async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: "class-1" });
    const service = new CoursePlanService({ learningClass: { findFirst } } as unknown as PrismaService);
    const internals = service as unknown as { ownedClass(classId: string, teacherId: string): Promise<unknown> };

    await internals.ownedClass("class-1", "teacher-user-2");

    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: [{ id: "class-1" }, { code: "class-1" }],
        AND: [expect.objectContaining({
          status: "ACTIVE",
          deletedAt: null,
          OR: expect.arrayContaining([
            expect.objectContaining({ teacherMemberships: expect.any(Object) })
          ])
        })]
      })
    });
  });

  it("shares the review queue through an assigned course instead of limiting it to the author", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new CoursePlanService({ coursePlanDraft: { findMany } } as unknown as PrismaService);

    await service.list("reviewer-user");

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        course: expect.objectContaining({
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

  it("prevents the draft author from approving a course plan and requires a reviewer membership", async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: "plan-1",
      requestedById: "author-user",
      status: "IN_REVIEW",
      version: 1,
      reviewHistoryJson: []
    });
    const service = new CoursePlanService({ coursePlanDraft: { findFirst } } as unknown as PrismaService);

    await expect(service.approve("plan-1", { comment: "Tự duyệt" }, "author-user"))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "plan-1",
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
    }));
  });

  it("prevents the last editor from approving the same course-plan version", async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: "plan-1",
      requestedById: "original-author",
      status: "IN_REVIEW",
      version: 2,
      reviewHistoryJson: [],
      metadataJson: { lastEditedById: "reviewer-editor" }
    });
    const service = new CoursePlanService({ coursePlanDraft: { findFirst } } as unknown as PrismaService);

    await expect(service.approve("plan-1", { comment: "Tự duyệt sau khi sửa" }, "reviewer-editor"))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
