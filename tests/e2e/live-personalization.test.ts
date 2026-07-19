import "dotenv/config";
import { describe, expect, it } from "vitest";

const apiUrl = process.env.E2E_API_URL?.replace(/\/$/, "");
const liveDescribe = apiUrl ? describe : describe.skip;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiUrl) throw new Error("E2E_API_URL is required");
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers }
  });
  const body = await response.json().catch(() => null) as T | { message?: string } | null;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${path}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

liveDescribe("live Supabase personalization flow", () => {
  it("authenticates, persists an attempt and returns a DB-backed target", async () => {
    const health = await request<{ status: string; dependencies: { database: string } }>("/health");
    expect(health).toMatchObject({
      status: "ok",
      dependencies: { database: "supabase-postgresql-ready" }
    });

    const auth = await request<{ accessToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: process.env.E2E_STUDENT_EMAIL ?? "minh@edurecall.local",
        password: process.env.E2E_STUDENT_PASSWORD ?? "Demo@123"
      })
    });
    const headers = { authorization: `Bearer ${auth.accessToken}` };
    const dashboard = await request<{ course: { id: string } }>("/students/me/dashboard", { headers });
    const course = await request<{
      modules: Array<{ lessons: Array<{ id: string; conceptCode: string }> }>;
    }>(`/courses/${dashboard.course.id}`, { headers });
    const rangeLesson = course.modules
      .flatMap((module) => module.lessons)
      .find((lesson) => lesson.conceptCode === "PYTHON_RANGE");
    expect(rangeLesson, "pilot course must contain PYTHON_RANGE").toBeTruthy();

    const lesson = await request<{
      sections: Array<{
        phase: string;
        activities?: Array<{ id: string; code: string; difficulty: number; content: { responseMode?: string } }>;
      }>;
    }>(`/lessons/${rangeLesson!.id}`, { headers });
    const exercise = lesson.sections
      .flatMap((section) => section.activities ?? [])
      .find((activity) => activity.code === "EX-08-1")
      ?? lesson.sections.flatMap((section) => section.activities ?? [])[0];
    expect(exercise, "pilot lesson must contain an active exercise").toBeTruthy();

    const outcome = await request<{
      id: string;
      analysis: {
        mode: string;
        recommendation: { target: { id: string }; evidence: { attemptIds?: string[] } };
      };
    }>("/attempts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        idempotencyKey: `attempt-${crypto.randomUUID()}`,
        courseId: dashboard.course.id,
        activityId: exercise!.id,
        submission: {
          kind: exercise!.content.responseMode === "PSEUDOCODE" ? "PSEUDOCODE" : "TEXT",
          text: "NHẬN điểm bắt đầu và điểm dừng; LẶP qua từng số trước điểm dừng; HIỂN THỊ kết quả"
        },
        usedHint: false,
        skipped: false,
        responseTimeMs: 4_200
      })
    });

    expect(outcome.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(outcome.analysis.recommendation.target.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(["AI_SERVICE", "DETERMINISTIC_FALLBACK"]).toContain(outcome.analysis.mode);

    const persisted = await request<{ id: string; analysis: unknown }>(`/attempts/${outcome.id}/analysis`, { headers });
    expect(persisted.id).toBe(outcome.id);
    expect(persisted.analysis).toBeTruthy();
  }, 45_000);
});
