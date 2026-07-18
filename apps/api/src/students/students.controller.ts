import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { DemoStoreService } from "../shared/demo-store.service";

const concepts = [
  ["PYTHON_VARIABLES", "Biến và kiểu dữ liệu"],
  ["PYTHON_OPERATORS", "Toán tử"],
  ["PYTHON_IF_ELSE", "Điều kiện if/else"],
  ["PYTHON_FOR", "Vòng lặp for"],
  ["PYTHON_RANGE", "Hàm range()"],
  ["PYTHON_WHILE", "Vòng lặp while"],
  ["PYTHON_LISTS", "List và index"],
  ["PYTHON_FUNCTIONS", "Hàm cơ bản"]
] as const;

const demoStudentId = "student-minh";

const courseModules = [
  { id: "module-1", title: "Khởi động cùng Python", description: "Môi trường, biến, dữ liệu đầu vào và phép tính.", progress: 1, lessons: [["lesson-01", "Ra lệnh cho máy tính", "PYTHON_OUTPUT", 45], ["lesson-02", "Biến và kiểu dữ liệu", "PYTHON_VARIABLES", 55], ["lesson-03", "Nhập liệu và phép tính", "PYTHON_OPERATORS", 60]] },
  { id: "module-2", title: "Chương trình biết lựa chọn", description: "Biểu thức đúng/sai và nhánh xử lý rõ ràng.", progress: 1, lessons: [["lesson-04", "So sánh và giá trị đúng/sai", "PYTHON_BOOLEAN", 55], ["lesson-05", "Rẽ nhánh với if / elif / else", "PYTHON_IF_ELSE", 70], ["lesson-06", "Checkpoint: Trợ lý kế hoạch học", "PYTHON_IF_ELSE", 60]] },
  { id: "module-3", title: "Lặp có kiểm soát", description: "for, range, while và cách tránh vòng lặp vô hạn.", progress: 0.34, lessons: [["lesson-07", "Vòng lặp for", "PYTHON_FOR", 55], ["lesson-08", "Khám phá range()", "PYTHON_RANGE", 65], ["lesson-09", "while và điều kiện dừng", "PYTHON_WHILE", 70]] },
  { id: "module-4", title: "Dữ liệu, hàm và dự án", description: "List, hàm và trò chơi hỏi–đáp cuối khóa.", progress: 0, lessons: [["lesson-10", "List và vị trí phần tử", "PYTHON_LISTS", 65], ["lesson-11", "Hàm, tham số và return", "PYTHON_FUNCTIONS", 75], ["lesson-12", "Dự án: Trò chơi hỏi–đáp", "PYTHON_PROJECT", 120]] }
] as const;

@ApiTags("students")
@ApiBearerAuth()
@Roles("STUDENT")
@UseGuards(AuthGuard, RolesGuard)
@Controller("students/me")
export class StudentsController {
  private goal = { objective: "Tự viết một mini game Python", weeks: 4, weeklyMinutes: 120 };

  constructor(private readonly store: DemoStoreService) {}

  @Get("dashboard")
  dashboard(): Record<string, unknown> {
    return {
      student: { id: "student-minh", name: "Minh", nickname: "Minh 🌱", xp: 860, level: 4, streak: 7, avatar: "avatar-01" },
      goal: this.goal,
      course: { id: "course-python", title: "Python cơ bản cho học sinh", progress: 0.46, cover: "course-cover-01" },
      focus: { conceptCode: "PYTHON_RANGE", mastery: this.store.getConceptMastery(demoStudentId, "PYTHON_RANGE", 0.42), reason: "Mastery khởi điểm thấp; cần một câu chẩn đoán về stop của range()" },
      dueReviews: this.store.publishedContents().length || 2,
      recommendationMode: [...this.store.attempts.values()]
        .filter((attempt) => attempt.studentId === demoStudentId)
        .at(-1)?.analysis?.mode ?? "AI_SERVICE",
      weeklyActivity: [22, 34, 18, 45, 38, 51, 29],
      badges: ["badge-seed", "badge-streak", "badge-debugger"]
    };
  }

  @Post("goals")
  goals(@Body() body: { objective?: string; weeks?: number; weeklyMinutes?: number }): Record<string, unknown> {
    this.goal = {
      objective: body.objective ?? this.goal.objective,
      weeks: body.weeks ?? this.goal.weeks,
      weeklyMinutes: body.weeklyMinutes ?? this.goal.weeklyMinutes
    };
    return { saved: true, goal: this.goal, pathRegenerated: true };
  }

  @Get("path")
  path(): Record<string, unknown> {
    return {
      version: "path-v1",
      goal: this.goal,
      nodes: concepts.map(([code, title], index) => ({
        id: `path-${index + 1}`,
        conceptCode: code,
        title,
        state: index < 4 ? "COMPLETED" : index === 4 ? "CURRENT" : "LOCKED",
        mastery: this.store.getConceptMastery(demoStudentId, code, 0.3),
        activity: index === 4 ? "MICRO_LESSON" : index % 3 === 0 ? "GAME" : "LESSON"
      }))
    };
  }

  @Get("concepts")
  conceptStates(): Record<string, unknown>[] {
    return concepts.map(([code, title]) => {
      const mastery = this.store.getConceptMastery(demoStudentId, code, 0.3);
      return { code, title, mastery, retrievability: Math.max(0.12, mastery - 0.08), forgettingRisk: Math.min(0.88, 1.08 - mastery), stability: Number((1.4 + mastery * 5).toFixed(2)) };
    });
  }

  @Get("reviews")
  reviews(): Record<string, unknown> {
    return {
      due: this.store.publishedContents(),
      schedule: [
        { conceptCode: "PYTHON_RANGE", dueAt: new Date().toISOString(), intervalDays: 1, reason: "Retrievability dưới 50%" },
        { conceptCode: "PYTHON_WHILE", dueAt: new Date(Date.now() + 86_400_000).toISOString(), intervalDays: 2, reason: "Recent failure" }
      ]
    };
  }

  @Get("recommendations")
  recommendations(): Record<string, unknown>[] {
    return [...this.store.attempts.values()]
      .filter((attempt) => attempt.studentId === demoStudentId && attempt.analysis)
      .map((attempt) => ({ id: `rec-${attempt.id}`, conceptCode: attempt.conceptCode, ...attempt.analysis?.recommendation, diagnosis: attempt.analysis?.diagnosis, mode: attempt.analysis?.mode }));
  }

  @Get("progress")
  progress(): Record<string, unknown> {
    return {
      masteryHistory: [
        { week: "Tuần 1", mastery: 0.31, retention: 0.42 },
        { week: "Tuần 2", mastery: 0.39, retention: 0.5 },
        { week: "Tuần 3", mastery: 0.49, retention: 0.57 },
        { week: "Tuần 4", mastery: 0.58, retention: 0.66 }
      ],
      studyMinutes: 237,
      exercisesCompleted: 38,
      reviewAccuracy: 0.76
    };
  }

  @Get("leaderboard")
  leaderboard(): Record<string, unknown> {
    return {
      enabled: true,
      boards: {
        class: [...this.store.students].sort((a, b) => b.xp - a.xp).slice(0, 10),
        mostImproved: [...this.store.students].sort((a, b) => a.progress - b.progress).slice(0, 10),
        recallMaster: [...this.store.students].sort((a, b) => b.streak - a.streak).slice(0, 10)
      }
    };
  }
}

@ApiTags("courses")
@Controller()
export class CoursesController {
  @Get("courses/:id")
  course(@Param("id") id: string): Record<string, unknown> {
    return {
      id,
      title: "Python căn bản: Từ câu lệnh đầu tiên đến trò chơi tương tác",
      description: "Khóa học 6 tuần dành cho học sinh lớp 6–9 mới bắt đầu; 12 bài có đủ lý thuyết, thực hành và kiểm tra cuối bài.",
      audience: "Lớp 6–9 · người mới bắt đầu",
      durationMinutes: 960,
      cadence: "3 buổi/tuần · 45–60 phút/buổi",
      finalProduct: "Trò chơi hỏi–đáp có điểm số và nhiều lượt chơi",
      modules: courseModules.map((module) => ({
        ...module,
        lessons: module.lessons.map(([lessonId, title, conceptCode, durationMinutes], index) => ({
          id: lessonId,
          title,
          conceptCode,
          durationMinutes,
          status: module.id === "module-1" || module.id === "module-2" || lessonId === "lesson-07" ? "COMPLETED" : lessonId === "lesson-08" ? "CURRENT" : "LOCKED",
          phases: [
            { phase: "THEORY", activityTypes: ["LECTURE", "VIDEO", "DOCUMENT"] },
            { phase: "PRACTICE", activityTypes: ["CODE", "MULTIPLE_CHOICE", "DEBUG"] },
            { phase: "CHECKPOINT", activityTypes: ["MULTIPLE_CHOICE", "CODE"] }
          ],
          order: courseModules.findIndex((item) => item.id === module.id) * 3 + index + 1
        }))
      }))
    };
  }

  @Get("lessons/:id")
  lesson(@Param("id") id: string): Record<string, unknown> {
    return {
      id,
      title: "Khám phá range()",
      conceptCode: "PYTHON_RANGE",
      moduleId: "module-3",
      order: 8,
      durationMinutes: 65,
      objectives: ["Đọc đúng start và stop", "Dự đoán dãy", "Tránh bẫy stop included"],
      sections: [
        { phase: "THEORY", title: "Lý thuyết", durationMinutes: 23, resources: [{ type: "LECTURE", title: "Start, stop và step" }, { type: "VIDEO", title: "Robot Mầm đi qua trạm số", durationMinutes: 6 }, { type: "DOCUMENT", title: "Phiếu ghi nhớ range()" }] },
        { phase: "PRACTICE", title: "Thực hành", durationMinutes: 29, activities: [{ id: "range-predict-01", type: "MULTIPLE_CHOICE", difficulty: 0.45 }, { id: "range-code-02", type: "CODE", difficulty: 0.55 }, { id: "range-debug-03", type: "DEBUG", difficulty: 0.6 }] },
        { phase: "CHECKPOINT", title: "Kiểm tra cuối bài", durationMinutes: 13, passRule: { minimumCorrect: 2, totalQuestions: 3 }, updatesPath: true }
      ]
    };
  }
}
