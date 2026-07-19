import type { AuthenticatedRequest } from "../auth/auth.guard";
import { PrismaService } from "../database/prisma.service";
import { CoursesController } from "./students.controller";
import type { LessonProgressService } from "./lesson-progress.service";

describe("CoursesController object authorization", () => {
  const courseFindFirst = jest.fn();
  const prisma = { course: { findFirst: courseFindFirst } } as unknown as PrismaService;
  const progress = { snapshot: jest.fn() } as unknown as LessonProgressService;
  const controller = new CoursesController(prisma, progress);

  beforeEach(() => {
    jest.clearAllMocks();
    courseFindFirst.mockResolvedValue({
      id: "course-1",
      code: "PYTHON",
      title: "Python",
      description: "Course",
      estimatedHours: 12,
      coverAssetKey: null,
      metadataJson: {},
      modules: []
    });
  });

  it("requires a teacher to be assigned through an active class enrollment", async () => {
    const request = { user: { id: "teacher-2", role: "TEACHER" } } as unknown as AuthenticatedRequest;

    await controller.course(request, "course-1");

    expect(courseFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
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
    }));
  });

  it("requires a student to have an active enrollment in the requested course", async () => {
    const request = { user: { id: "student-1", role: "STUDENT" } } as unknown as AuthenticatedRequest;
    (progress.snapshot as jest.Mock).mockResolvedValue({ lessons: [], progress: 0, storedEnrollmentProgress: 0, completedLessons: 0, totalLessons: 0, courseCompleted: false, currentLocation: null });

    await controller.course(request, "course-1");

    expect(courseFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        enrollments: {
          some: expect.objectContaining({
            student: { userId: "student-1", status: "ACTIVE", deletedAt: null },
            status: "ACTIVE",
            deletedAt: null
          })
        }
      })
    }));
  });
});
