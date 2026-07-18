import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { DemoStoreService } from "../shared/demo-store.service";

const conceptCodes = [
  "PYTHON_VARIABLES", "PYTHON_OPERATORS", "PYTHON_IF_ELSE", "PYTHON_FOR",
  "PYTHON_RANGE", "PYTHON_WHILE", "PYTHON_LISTS", "PYTHON_FUNCTIONS"
];

const demoStudentId = "student-minh";

@ApiTags("teacher")
@Controller("teacher")
export class TeacherController {
  private leaderboardEnabled = true;

  constructor(private readonly store: DemoStoreService) {}

  @Get("dashboard")
  dashboard(): Record<string, unknown> {
    const attempts = [...this.store.attempts.values()];
    return {
      class: { id: "class-python-01", name: "Python Explorers", students: 20 },
      averageMastery: 0.58,
      activeToday: 17,
      needsSupport: this.store.students.filter((student) => student.needsSupport).length,
      dueReviews: 29,
      fallbackAnalyses: attempts.filter((attempt) => attempt.analysis?.mode === "DETERMINISTIC_FALLBACK").length,
      topGaps: [
        { conceptCode: "PYTHON_WHILE", mastery: 0.39, students: 9 },
        { conceptCode: "PYTHON_RANGE", mastery: this.store.getConceptMastery(demoStudentId, "PYTHON_RANGE", 0.42), students: 7 },
        { conceptCode: "PYTHON_FUNCTIONS", mastery: 0.46, students: 6 }
      ],
      misconceptions: [
        { code: "RANGE_STOP_INCLUDED", students: 7, attempts: 18, trend: "+3" },
        { code: "WHILE_VARIABLE_NOT_UPDATED", students: 5, attempts: 12, trend: "-1" },
        { code: "LIST_INDEX_STARTS_AT_ONE", students: 4, attempts: 8, trend: "0" }
      ],
      reviewQueue: [...this.store.contents.values()].filter((content) => content.status !== "PUBLISHED").length
    };
  }

  @Get("classes")
  classes(): Record<string, unknown>[] {
    return [{ id: "class-python-01", name: "Python Explorers", course: "Python cơ bản cho học sinh", students: 20, averageMastery: 0.58, activeToday: 17 }];
  }

  @Get("classes/:id")
  classDetail(@Param("id") id: string): Record<string, unknown> {
    return { id, name: "Python Explorers", students: this.store.students, courseProgress: 0.46, leaderboardEnabled: this.leaderboardEnabled };
  }

  @Get("classes/:id/heatmap")
  heatmap(@Param("id") id: string): Record<string, unknown> {
    return {
      classId: id,
      concepts: conceptCodes,
      rows: this.store.students.map((student, studentIndex) => ({
        studentId: student.id,
        name: student.name,
        values: conceptCodes.map((code, conceptIndex) => ({
          conceptCode: code,
          mastery: this.store.getConceptMastery(
            student.id,
            code,
            Number((0.24 + ((studentIndex * 7 + conceptIndex * 11) % 62) / 100).toFixed(2))
          )
        }))
      }))
    };
  }

  @Get("classes/:id/gaps")
  gaps(@Param("id") id: string): Record<string, unknown> {
    return {
      classId: id,
      concepts: [
        { code: "PYTHON_WHILE", averageMastery: 0.39, affectedStudents: 9, prerequisiteImpact: 0.82 },
        { code: "PYTHON_RANGE", averageMastery: 0.42, affectedStudents: 7, prerequisiteImpact: 0.76 },
        { code: "PYTHON_FUNCTIONS", averageMastery: 0.46, affectedStudents: 6, prerequisiteImpact: 0.9 }
      ]
    };
  }

  @Get("students/:id")
  student(@Param("id") id: string): Record<string, unknown> {
    const student = this.store.students.find((item) => item.id === id) ?? this.store.students[0];
    const studentId = student?.id ?? demoStudentId;
    return {
      ...student,
      goal: "Tự viết một mini game Python sau 4 tuần",
      conceptStates: conceptCodes.map((code, index) => {
        const mastery = this.store.getConceptMastery(studentId, code, Number((0.36 + (index % 5) * 0.09).toFixed(2)));
        return { code, mastery, retrievability: Math.max(0.12, Number((mastery - 0.08).toFixed(2))) };
      }),
      timeline: [...this.store.attempts.values()].filter((attempt) => attempt.studentId === studentId),
      beforeAfter: { beforeReview: 0.42, afterReview: this.store.getConceptMastery(studentId, "PYTHON_RANGE", 0.42) }
    };
  }

  @Get("students/:id/recommendations")
  recommendations(@Param("id") id: string): Record<string, unknown>[] {
    return [...this.store.attempts.values()]
      .filter((attempt) => attempt.studentId === id && attempt.analysis)
      .map((attempt) => ({ attemptId: attempt.id, ...attempt.analysis?.recommendation, diagnosis: attempt.analysis?.diagnosis, explanations: attempt.analysis?.explanations }));
  }

  @Get("recommendations/:id")
  recommendation(@Param("id") id: string): Record<string, unknown> {
    const attempt = [...this.store.attempts.values()].find((item) => `rec-${item.id}` === id || item.id === id) ?? [...this.store.attempts.values()].at(-1);
    return attempt?.analysis
      ? { id, studentId: attempt.studentId, conceptCode: attempt.conceptCode, recommendation: attempt.analysis.recommendation, diagnosis: attempt.analysis.diagnosis, explanations: attempt.analysis.explanations }
      : { id, status: "NO_EVIDENCE", message: "Submit a demo attempt to create recommendation evidence." };
  }

  @Get("analytics/mastery")
  mastery(): Record<string, unknown> {
    return { series: [0.31, 0.37, 0.43, 0.49, 0.58], labels: ["W0", "W1", "W2", "W3", "W4"], change: 0.27 };
  }

  @Get("analytics/misconceptions")
  misconceptionAnalytics(): Record<string, unknown> {
    return { grouped: [{ code: "RANGE_STOP_INCLUDED", students: 7, contentReuse: 4 }, { code: "WHILE_VARIABLE_NOT_UPDATED", students: 5, contentReuse: 2 }] };
  }

  @Get("analytics/content-production")
  production(): Record<string, unknown> {
    const contents = [...this.store.contents.values()];
    return {
      generated: contents.length,
      published: contents.filter((item) => item.status === "PUBLISHED").length,
      averageGenerationMs: contents.length ? Math.round(contents.reduce((sum, item) => sum + item.generationMs, 0) / contents.length) : 0,
      reuseCount: contents.reduce((sum, item) => sum + item.reuseCount, 0),
      estimatedCostUsd: contents.reduce((sum, item) => sum + item.estimatedCostUsd, 0),
      provider: "Local demo provider"
    };
  }

  @Get("analytics/retention")
  retention(): Record<string, unknown> {
    return { averageRetrievability: 0.64, dueIn24Hours: 29, successfulReviews: 0.76, intervals: { oneDay: 8, threeDays: 13, sevenDays: 11 } };
  }

  @Get("analytics/models")
  modelStatus(): Record<string, unknown> {
    const artifact = path.join(process.cwd(), "apps", "ai-service", "ml", "artifacts", "next_attempt_model.joblib");
    const metricsPath = path.join(process.cwd(), "apps", "ai-service", "ml", "artifacts", "evaluation.json");
    const metrics: unknown = existsSync(metricsPath) ? JSON.parse(readFileSync(metricsPath, "utf8")) : null;
    return { bkt: { version: "bkt-v1", status: "ACTIVE" }, nextAttempt: { version: "next-attempt-logreg-v1", artifactPresent: existsSync(artifact), metrics }, dataNotice: "SYNTHETIC DATA — NOT REAL EDUONE DATA" };
  }

  @Patch("leaderboard/settings")
  settings(@Body("enabled") enabled: boolean): Record<string, unknown> {
    this.leaderboardEnabled = Boolean(enabled);
    return { enabled: this.leaderboardEnabled, updatedAt: new Date().toISOString() };
  }
}
