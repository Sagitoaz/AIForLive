import { NotFoundException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { PrismaService } from "../database/prisma.service";
import { TeacherController } from "./teacher.controller";

describe("TeacherController class membership authorization", () => {
  const classFindFirst = jest.fn();
  const stateFindMany = jest.fn();
  const prisma = {
    learningClass: { findFirst: classFindFirst },
    studentConceptState: { findMany: stateFindMany }
  } as unknown as PrismaService;
  const controller = new TeacherController(prisma);
  const request = {
    user: {
      id: "secondary-teacher-user",
      email: "thay.nam@edurecall.local",
      displayName: "Thầy Nam",
      role: "TEACHER"
    }
  } as unknown as AuthenticatedRequest;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows either the primary teacher or an active non-deleted membership", async () => {
    classFindFirst.mockResolvedValue({
      id: "class-id",
      code: "PYTHON-PILOT-01",
      name: "Lớp Python thí điểm — 20 học sinh",
      leaderboardEnabled: true,
      enrollments: [
        {
          studentProfileId: "student-profile-id",
          progress: 0.4,
          course: { id: "course-id", code: "PYTHON-FOUNDATIONS-DEMO", title: "Python cơ bản" },
          student: {
            id: "student-profile-id",
            userId: "student-user-id",
            xp: 120,
            streakDays: 2,
            learningGoal: "Học Python",
            metadataJson: {},
            user: {
              id: "student-user-id",
              userId: "student-user-id",
              displayName: "Minh",
              nickname: "Minh",
              avatarKey: "avatar-student-01"
            }
          }
        }
      ]
    });
    stateFindMany.mockResolvedValue([
      { studentProfileId: "student-profile-id", mastery: 0.62 }
    ]);

    await expect(controller.classDetail(request, "PYTHON-PILOT-01")).resolves.toMatchObject({
      id: "class-id",
      students: [{ name: "Minh", mastery: 0.62 }]
    });
    expect(classFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { OR: [{ id: "PYTHON-PILOT-01" }, { code: "PYTHON-PILOT-01" }] },
          {
            status: "ACTIVE",
            deletedAt: null,
            OR: [
              { teacher: { userId: "secondary-teacher-user", status: "ACTIVE", deletedAt: null } },
              {
                teacherMemberships: {
                  some: {
                    teacher: { userId: "secondary-teacher-user", status: "ACTIVE", deletedAt: null },
                    role: { in: ["OWNER", "INSTRUCTOR"] },
                    status: "ACTIVE",
                    deletedAt: null
                  }
                }
              }
            ]
          }
        ]
      }
    }));
  });

  it("does not expose a class when neither ownership path matches", async () => {
    classFindFirst.mockResolvedValue(null);

    await expect(controller.classDetail(request, "another-class")).rejects.toBeInstanceOf(NotFoundException);
    expect(stateFindMany).not.toHaveBeenCalled();
  });

  it("does not give a content reviewer access to identifiable learner rows", async () => {
    classFindFirst.mockResolvedValue(null);
    const reviewerRequest = {
      user: {
        id: "reviewer-user",
        email: "co.linh@edurecall.local",
        displayName: "Cô Linh",
        role: "TEACHER"
      }
    } as unknown as AuthenticatedRequest;

    await expect(controller.classDetail(reviewerRequest, "PYTHON-PILOT-01"))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(classFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                teacherMemberships: {
                  some: expect.objectContaining({
                    role: { in: ["OWNER", "INSTRUCTOR"] }
                  })
                }
              })
            ])
          })
        ])
      })
    }));
  });
});

describe("TeacherController primary demo class selection", () => {
  const teacherProfileFindFirst = jest.fn();
  const classFindMany = jest.fn();
  const prisma = {
    teacherProfile: { findFirst: teacherProfileFindFirst },
    learningClass: { findMany: classFindMany }
  } as unknown as PrismaService;
  const controller = new TeacherController(prisma);
  const teacherContext = (userId: string) => (
    controller as unknown as {
      teacherContext: (id: string) => Promise<{ classes: Array<{ id: string }> }>;
    }
  ).teacherContext(userId);

  beforeEach(() => {
    jest.clearAllMocks();
    teacherProfileFindFirst.mockResolvedValue({ id: "teacher-profile-1", user: {} });
  });

  it("places the explicitly marked demo class before an older legacy class", async () => {
    classFindMany.mockResolvedValue([
      { id: "legacy-class", metadataJson: {}, enrollments: [] },
      {
        id: "pilot-class",
        metadataJson: { fixture: "pilot-v1", primaryDemoClass: true },
        enrollments: []
      }
    ]);

    await expect(teacherContext("teacher-user-1")).resolves.toMatchObject({
      classes: [{ id: "pilot-class" }, { id: "legacy-class" }]
    });
  });

  it("preserves database order when classes have equal priority", async () => {
    classFindMany.mockResolvedValue([
      { id: "first-class", metadataJson: {}, enrollments: [] },
      { id: "second-class", metadataJson: {}, enrollments: [] }
    ]);

    await expect(teacherContext("teacher-user-1")).resolves.toMatchObject({
      classes: [{ id: "first-class" }, { id: "second-class" }]
    });
  });
});
