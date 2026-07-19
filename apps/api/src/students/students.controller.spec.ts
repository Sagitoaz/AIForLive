import { PrismaService } from "../database/prisma.service";
import type { LessonProgressService } from "./lesson-progress.service";
import { StudentsController } from "./students.controller";

describe("StudentsController learning context selection", () => {
  const studentProfileFindFirst = jest.fn();
  const prisma = {
    studentProfile: { findFirst: studentProfileFindFirst }
  } as unknown as PrismaService;
  const progress = {} as LessonProgressService;
  const controller = new StudentsController(prisma, progress);
  const studentContext = (userId: string) => (
    controller as unknown as {
      studentContext: (id: string) => Promise<{ enrollments: Array<{ id: string }> }>;
    }
  ).studentContext(userId);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefers the explicit primary learning context over a newer legacy enrollment", async () => {
    studentProfileFindFirst.mockResolvedValue({
      id: "student-profile-1",
      enrollments: [
        {
          id: "legacy-enrollment",
          enrolledAt: new Date("2026-07-19T09:00:00.000Z"),
          metadataJson: {},
          course: {},
          class: {}
        },
        {
          id: "demo-enrollment",
          enrolledAt: new Date("2026-07-18T09:00:00.000Z"),
          metadataJson: {
            fixture: "eduone-demo-v2",
            primaryLearningContext: true
          },
          course: {},
          class: {}
        }
      ]
    });

    await expect(studentContext("student-user-1")).resolves.toMatchObject({
      enrollments: [{ id: "demo-enrollment" }, { id: "legacy-enrollment" }]
    });
    expect(studentProfileFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "student-user-1", status: "ACTIVE", deletedAt: null },
      include: expect.objectContaining({
        enrollments: expect.objectContaining({ take: 10 })
      })
    }));
  });

  it("uses the newest enrollment when no primary or fixture marker exists", async () => {
    studentProfileFindFirst.mockResolvedValue({
      id: "student-profile-1",
      enrollments: [
        {
          id: "older-enrollment",
          enrolledAt: new Date("2026-07-18T09:00:00.000Z"),
          metadataJson: {},
          course: {},
          class: {}
        },
        {
          id: "newer-enrollment",
          enrolledAt: new Date("2026-07-19T09:00:00.000Z"),
          metadataJson: {},
          course: {},
          class: {}
        }
      ]
    });

    await expect(studentContext("student-user-1")).resolves.toMatchObject({
      enrollments: [{ id: "newer-enrollment" }, { id: "older-enrollment" }]
    });
  });
});
