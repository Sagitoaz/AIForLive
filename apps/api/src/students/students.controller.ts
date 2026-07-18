import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
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

@ApiTags("students")
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
      title: "Python cơ bản cho học sinh",
      description: "10 bài học, 50 nhiệm vụ và 4 mini-game trong một lộ trình cá nhân hóa.",
      modules: [
        { id: "module-1", title: "Khởi động", lessons: 3, progress: 1 },
        { id: "module-2", title: "Ra quyết định", lessons: 2, progress: 0.65 },
        { id: "module-3", title: "Lặp thông minh", lessons: 3, progress: 0.25 },
        { id: "module-4", title: "Dữ liệu & hàm", lessons: 2, progress: 0 }
      ]
    };
  }

  @Get("lessons/:id")
  lesson(@Param("id") id: string): Record<string, unknown> {
    return {
      id,
      title: "Khám phá range()",
      conceptCode: "PYTHON_RANGE",
      objectives: ["Đọc đúng start và stop", "Dự đoán dãy", "Tránh bẫy stop included"],
      sections: [
        { type: "TEXT", title: "Vạch dừng", body: "range dừng trước stop." },
        { type: "CODE", title: "Thử nhanh", code: "list(range(1, 5))" },
        { type: "CHECK", title: "Tự kiểm tra", question: "Phần tử cuối là gì?" }
      ]
    };
  }
}
