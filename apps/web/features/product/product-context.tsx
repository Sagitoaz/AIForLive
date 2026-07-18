"use client";

import type { MicroLesson } from "@edurecall/shared-types";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

export type LessonPhase = "THEORY" | "PRACTICE" | "CHECKPOINT";

export interface AnalysisResult {
  mode: "AI_SERVICE" | "DETERMINISTIC_FALLBACK";
  mastery_before: number;
  mastery_after: number;
  retrievability: number;
  forgetting_risk: number;
  recommended_interval_days: number;
  diagnosis: { status: string; misconception_code: string | null; confidence: number; rule_id: string | null; evidence: string[] };
  recommendation: {
    action: string;
    priority_score: number;
    reasons: string[];
    evidence: Record<string, unknown>;
    target?: { type: string; id: string; title?: string; phase: LessonPhase; estimated_minutes: number; difficulty?: number };
  };
  explanations: string[];
}

export interface StudentDashboardData {
  student: { id: string; name: string; nickname: string; xp: number; level: number; streak: number; avatar: string | null };
  goal: { objective: string; weeks: number; weeklyMinutes: number };
  course: { id: string; code: string; title: string; progress: number; cover: string | null };
  focus: { conceptCode: string; mastery: number; reason: string } | null;
  dueReviews: number;
  recommendationMode: string;
  weeklyActivity: number[];
  badges: string[];
}

export interface ConceptData { id: string; code: string; title: string; mastery: number; retrievability: number; forgettingRisk: number; stability: number }
export interface ExerciseData { id: string; code: string; type: string; prompt: string; difficulty: number; content: { options?: string[]; [key: string]: unknown } }
export interface LessonResourceData { id: string; type: string; title: string; content: Record<string, unknown> }
export interface LessonData {
  id: string;
  code: string;
  title: string;
  summary: string;
  conceptCode: string;
  durationMinutes: number;
  objectives: string[];
  reviewable: boolean;
  sections: Array<{ phase: LessonPhase; title: string; resources?: LessonResourceData[]; activities?: ExerciseData[]; passRule?: { minimumCorrect: number; totalQuestions: number } }>;
}
export interface CourseLessonData { id: string; code: string; title: string; summary: string; conceptCode: string; durationMinutes: number; status: "COMPLETED" | "CURRENT" | "NOT_STARTED" | "AVAILABLE" | string; reviewable: boolean; completedActivities?: number; totalActivities?: number }
export interface CourseData { id: string; code: string; title: string; description: string; audience: string; durationMinutes: number; cadence: string; finalProduct: string; modules: Array<{ id: string; code: string; title: string; description: string; order: number; lessons: CourseLessonData[] }> }
export interface RecommendationData { id: string; conceptCode: string; conceptTitle: string; action: string; priorityScore: number; reasons: string[]; target: { type: string; id: string; phase: string; estimatedMinutes: number } | null; status: string; modelVersion: string; evidence: unknown[]; createdAt: string }
export interface ReviewData { due: Array<{ id: string; title: string }>; schedule: Array<{ id: string; conceptCode: string; title: string; dueAt: string; intervalDays: number; reason: string; recommendationId: string | null }> }
export interface ProgressData { masteryHistory: Array<{ week: string; mastery: number; retention: number }>; studyMinutes: number; exercisesCompleted: number; reviewAccuracy: number }
export interface LeaderboardData { enabled: boolean; boards: { class: Array<{ id: string; name: string; xp: number; streak: number; progress: number; mastery: number }>; mostImproved: Array<{ id: string; name: string; xp: number; streak: number; progress: number; mastery: number }>; recallMaster: Array<{ id: string; name: string; xp: number; streak: number; progress: number; mastery: number }> } }
export interface TeacherDashboardData { class: { id: string; name: string; students: number }; averageMastery: number; activeToday: number; needsSupport: number; dueReviews: number; fallbackAnalyses: number; topGaps: Array<{ conceptCode: string; title: string; mastery: number; students: number }>; misconceptions: Array<{ code: string; students: number; attempts: number }>; reviewQueue: number }
export interface ClassData { id: string; name: string; leaderboardEnabled: boolean; course?: { id: string; code: string; title: string }; students: Array<{ id: string; profileId: string; name: string; nickname: string; avatar: string; xp: number; streak: number; progress: number; mastery: number; needsSupport: boolean; goal: string }> }
export interface HeatmapData { classId: string; concepts: Array<{ id: string; code: string; title: string }>; rows: Array<{ studentId: string; name: string; values: Array<{ conceptCode: string; mastery: number | null; dataAvailable: boolean }> }> }
export interface SourceData { id: string; courseId: string; name: string; mimeType: string; sizeBytes: number; checksum: string; status: string; extractedPreview: string; createdAt: string }

export interface GenerationBrief {
  draftKind: "FULL_LESSON" | "REMEDIATION";
  sourceId?: string;
  conceptCode?: string;
  misconceptionCode?: string;
  level?: string;
  gradeBand?: string;
  learningObjective?: string;
  durationMinutes?: number;
  provider?: "LOCAL_TEMPLATE" | "EXTERNAL_LLM";
}

export interface CoursePlanLesson {
  lessonId: string;
  moduleId: string;
  moduleTitle: string;
  conceptCode: string;
  title: string;
  estimatedMinutes: number;
  selectionScore: number;
  reasons: string[];
  phases: Record<LessonPhase, { resourceIds: string[]; exerciseIds: string[]; activityCount: number }>;
}
export interface CoursePlanData {
  id: string;
  course: { id: string; code: string; title: string; version: number };
  class: { id: string | null; code: string | null; name: string } | null;
  title: string;
  gradeBand: string;
  goals: string[];
  durationWeeks: number;
  status: "DRAFT" | "IN_REVIEW" | "REVISION_REQUIRED" | "APPROVED" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
  version: number;
  provider: string;
  modelVersion: string;
  planJson: {
    estimatedMinutes: number;
    weeks: Array<{ week: number; title: string; focus: string; estimatedMinutes: number; lessons: CoursePlanLesson[] }>;
    explainability: { candidateCount: number; selectedLessonIds: string[]; selectionFactors: string[]; candidateLog?: Array<Record<string, unknown>> };
  };
  reviewHistory: Array<{ action: string; from: string; to: string; actorId: string; at: string; comment?: string }>;
  generationMs: number | null;
  updatedAt: string;
}
export interface CoursePlanBrief { courseId: string; classId?: string; className?: string; title?: string; gradeBand: string; goals: string[]; durationWeeks: number }

export interface AttemptOutcome { analysis: AnalysisResult; isCorrect: boolean; attemptId: string }

interface ProductContextValue {
  role: "student" | "teacher" | null;
  busy: boolean;
  backgroundLoading: boolean;
  operation: string | null;
  ready: boolean;
  message: string;
  error: string | null;
  student: StudentDashboardData | null;
  concepts: ConceptData[];
  course: CourseData | null;
  lesson: LessonData | null;
  recommendations: RecommendationData[];
  reviews: ReviewData | null;
  progress: ProgressData | null;
  leaderboard: LeaderboardData | null;
  games: Array<Record<string, unknown>>;
  teacher: TeacherDashboardData | null;
  classData: ClassData | null;
  heatmap: HeatmapData | null;
  sources: SourceData[];
  reviewQueue: MicroLesson[];
  generatedLesson: MicroLesson | null;
  coursePlans: CoursePlanData[];
  selectedCoursePlan: CoursePlanData | null;
  analysis: AnalysisResult | null;
  setRole: (role: "student" | "teacher") => Promise<void>;
  refresh: () => Promise<void>;
  openLesson: (id: string) => Promise<void>;
  submitAttempt: (exercise: ExerciseData, submittedAnswer: string, phase?: LessonPhase, responseTimeMs?: number) => Promise<AttemptOutcome>;
  generateLesson: (brief?: GenerationBrief | "FULL_LESSON" | "REMEDIATION") => Promise<MicroLesson>;
  selectGeneratedLesson: (id: string) => Promise<void>;
  updateLesson: (lesson: MicroLesson, teacherEditingSeconds?: number) => Promise<void>;
  submitLessonReview: () => Promise<void>;
  requestLessonRevision: () => Promise<void>;
  approveLesson: () => Promise<void>;
  publishLesson: () => Promise<void>;
  generateCoursePlan: (brief: CoursePlanBrief) => Promise<CoursePlanData>;
  selectCoursePlan: (id: string) => Promise<void>;
  updateCoursePlan: (id: string, input: Partial<Pick<CoursePlanData, "title" | "gradeBand" | "goals" | "durationWeeks">> & { planJson?: Record<string, unknown> }) => Promise<void>;
  transitionCoursePlan: (action: "submit-review" | "approve" | "request-revision" | "publish") => Promise<void>;
  completeQuiz: (selectedIndex: number, questionIndex?: number) => Promise<{ correct: boolean; masteryAfter: number }>;
  logout: () => void;
}

const ProductContext = createContext<ProductContextValue | null>(null);

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<"student" | "teacher" | null>(null);
  const [busy, setBusy] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [operation, setOperation] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Đang kết nối Supabase...");
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentDashboardData | null>(null);
  const [concepts, setConcepts] = useState<ConceptData[]>([]);
  const [course, setCourse] = useState<CourseData | null>(null);
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationData[]>([]);
  const [reviews, setReviews] = useState<ReviewData | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [games, setGames] = useState<Array<Record<string, unknown>>>([]);
  const [teacher, setTeacher] = useState<TeacherDashboardData | null>(null);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [sources, setSources] = useState<SourceData[]>([]);
  const [reviewQueue, setReviewQueue] = useState<MicroLesson[]>([]);
  const [generatedLesson, setGeneratedLesson] = useState<MicroLesson | null>(null);
  const [coursePlans, setCoursePlans] = useState<CoursePlanData[]>([]);
  const [selectedCoursePlan, setSelectedCoursePlan] = useState<CoursePlanData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const inFlightRole = useRef<{ role: "student" | "teacher"; promise: Promise<void> } | null>(null);
  const activeLessonId = useRef<string | null>(null);

  const refreshStudentSignals = useCallback(async () => {
    const [dashboard, conceptRows, recommendationRows, reviewRows] = await Promise.all([
      apiRequest<StudentDashboardData>("/students/me/dashboard"),
      apiRequest<ConceptData[]>("/students/me/concepts"),
      apiRequest<RecommendationData[]>("/students/me/recommendations"),
      apiRequest<ReviewData>("/students/me/reviews")
    ]);
    setStudent(dashboard);
    setConcepts(conceptRows);
    setRecommendations(recommendationRows);
    setReviews(reviewRows);
    return reviewRows;
  }, []);

  const loadStudent = useCallback(async () => {
    const [dashboard, conceptRows, recommendationRows, reviewRows] = await Promise.all([
      apiRequest<StudentDashboardData>("/students/me/dashboard"),
      apiRequest<ConceptData[]>("/students/me/concepts"),
      apiRequest<RecommendationData[]>("/students/me/recommendations"),
      apiRequest<ReviewData>("/students/me/reviews")
    ]);
    setStudent(dashboard);
    setConcepts(conceptRows);
    setRecommendations(recommendationRows);
    setReviews(reviewRows);

    setBackgroundLoading(true);
    const courseRequest = apiRequest<CourseData>(`/courses/${dashboard.course.id}`).then((courseRow) => {
      setCourse(courseRow);
      const lessons = courseRow.modules.flatMap((item) => item.lessons);
      const currentLesson = lessons.find((item) => item.status === "CURRENT")
        ?? lessons.find((item) => item.status === "NOT_STARTED" || item.status === "AVAILABLE")
        ?? lessons[0];
      if (!currentLesson) return;
      activeLessonId.current ??= currentLesson.id;
      return apiRequest<LessonData>(`/lessons/${currentLesson.id}`).then((row) => {
        if (activeLessonId.current === currentLesson.id) setLesson(row);
      });
    });

    const progressRequest = apiRequest<ProgressData>("/students/me/progress").then(setProgress);
    const leaderboardRequest = apiRequest<LeaderboardData>("/students/me/leaderboard").then(setLeaderboard);
    const gamesRequest = apiRequest<Array<Record<string, unknown>>>("/games").then(setGames);
    const publishedId = reviewRows.due[0]?.id;
    const publishedRequest = publishedId
      ? apiRequest<MicroLesson>(`/micro-lessons/${publishedId}`).then(setGeneratedLesson)
      : Promise.resolve();
    void Promise.allSettled([courseRequest, progressRequest, leaderboardRequest, gamesRequest, publishedRequest])
      .finally(() => setBackgroundLoading(false));
  }, []);

  const loadTeacher = useCallback(async () => {
    const [dashboard, sourceRows, queue, plans] = await Promise.all([
      apiRequest<TeacherDashboardData>("/teacher/dashboard"),
      apiRequest<SourceData[]>("/content-sources"),
      apiRequest<MicroLesson[]>("/teacher/reviews"),
      apiRequest<CoursePlanData[]>("/teacher/course-plans")
    ]);
    setTeacher(dashboard);
    setSources(sourceRows);
    setReviewQueue(queue);
    setGeneratedLesson((current) => current && queue.some((item) => item.id === current.id) ? queue.find((item) => item.id === current.id) ?? current : queue[0] ?? null);
    setCoursePlans(plans);
    setSelectedCoursePlan((current) => current && plans.some((item) => item.id === current.id) ? plans.find((item) => item.id === current.id) ?? current : plans[0] ?? null);
    setBackgroundLoading(true);
    const classRequest = apiRequest<ClassData>(`/teacher/classes/${dashboard.class.id}`).then(async (detail) => {
      setClassData(detail);
      if (detail.course?.id) setCourse(await apiRequest<CourseData>(`/courses/${detail.course.id}`));
    });
    const heatmapRequest = apiRequest<HeatmapData>(`/teacher/classes/${dashboard.class.id}/heatmap`).then(setHeatmap);
    void Promise.allSettled([classRequest, heatmapRequest]).finally(() => setBackgroundLoading(false));
  }, []);

  const load = useCallback(async (targetRole: "student" | "teacher") => {
    setBusy(true);
    setOperation("Đang tải dữ liệu từ Supabase...");
    setError(null);
    try {
      if (targetRole === "student") await loadStudent(); else await loadTeacher();
      setMessage("Dữ liệu trực tiếp từ Supabase");
      setReady(true);
    } catch (cause) {
      setReady(false);
      setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu từ API");
      setMessage("Mất kết nối API/Supabase");
      throw cause;
    } finally {
      setBusy(false);
      setOperation(null);
    }
  }, [loadStudent, loadTeacher]);

  const setRole = useCallback(async (nextRole: "student" | "teacher") => {
    if (role === nextRole && ready) return;
    if (inFlightRole.current?.role === nextRole) return inFlightRole.current.promise;
    setRoleState(nextRole);
    const promise = load(nextRole).finally(() => { inFlightRole.current = null; });
    inFlightRole.current = { role: nextRole, promise };
    return promise;
  }, [load, ready, role]);

  const refresh = useCallback(async () => { if (role) await load(role); }, [load, role]);

  const openLesson = useCallback(async (id: string) => {
    if (lesson?.id === id) return;
    activeLessonId.current = id;
    setBusy(true);
    setOperation("Đang mở bài học...");
    setError(null);
    try { setLesson(await apiRequest<LessonData>(`/lessons/${id}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được bài học"); throw cause; }
    finally { setBusy(false); setOperation(null); }
  }, [lesson?.id]);

  const submitAttempt = useCallback(async (exercise: ExerciseData, submittedAnswer: string, phase: LessonPhase = "PRACTICE", responseTimeMs = 0): Promise<AttemptOutcome> => {
    setBusy(true);
    setOperation("AI đang chấm và điều chỉnh lộ trình...");
    setError(null);
    try {
      const result = await apiRequest<{ id: string; isCorrect: boolean; analysis: AnalysisResult }>("/attempts", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: `${exercise.code}-${crypto.randomUUID()}`,
          domainCode: "python-foundations",
          courseId: course?.id ?? "",
          conceptCode: lesson?.conceptCode ?? "PYTHON_RANGE",
          activityId: exercise.id,
          lessonPhase: phase,
          isCorrect: false,
          usedHint: false,
          skipped: false,
          attemptNumber: 1,
          difficulty: exercise.difficulty,
          responseTimeMs: Math.max(0, Math.min(3_600_000, Math.round(responseTimeMs))),
          submittedAnswer,
          expectedAnswer: "server-owned"
        })
      });
      setAnalysis(result.analysis);
      setMessage(`AI đã phân tích attempt ${result.id.slice(0, 8)}`);
      void refreshStudentSignals().then((reviewRows) => {
        const publishedId = reviewRows.due[0]?.id;
        if (publishedId) void apiRequest<MicroLesson>(`/micro-lessons/${publishedId}`).then(setGeneratedLesson).catch(() => undefined);
      }).catch(() => undefined);
      void apiRequest<ProgressData>("/students/me/progress").then(setProgress).catch(() => undefined);
      if (course?.id) void apiRequest<CourseData>(`/courses/${course.id}`).then(setCourse).catch(() => undefined);
      return { analysis: result.analysis, isCorrect: result.isCorrect, attemptId: result.id };
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Không ghi được attempt";
      setError(text);
      throw cause;
    } finally { setBusy(false); setOperation(null); }
  }, [course?.id, lesson?.conceptCode, refreshStudentSignals]);

  const generateLesson = useCallback(async (briefOrKind: GenerationBrief | "FULL_LESSON" | "REMEDIATION" = "REMEDIATION") => {
    const brief: GenerationBrief = typeof briefOrKind === "string" ? { draftKind: briefOrKind } : briefOrKind;
    const source = sources.find((item) => item.id === brief.sourceId) ?? sources.find((item) => item.status === "VERIFIED");
    if (!source) throw new Error("Không có nguồn VERIFIED trên Supabase");
    setBusy(true);
    setOperation("AI đang phân tích nguồn và dựng bài học...");
    setError(null);
    try {
      const result = await apiRequest<MicroLesson>("/ai/content/generate", {
        method: "POST",
        body: JSON.stringify({
          domainCode: "python-foundations",
          conceptCode: brief.conceptCode ?? "PYTHON_RANGE",
          misconceptionCode: brief.misconceptionCode ?? "RANGE_STOP_INCLUDED",
          level: brief.level ?? "Mới bắt đầu",
          learningObjective: brief.learningObjective ?? "Đọc đúng start, stop, step và vận dụng range() trong bài toán đơn giản",
          durationMinutes: brief.durationMinutes ?? (brief.draftKind === "FULL_LESSON" ? 65 : 12),
          draftKind: brief.draftKind,
          gradeBand: brief.gradeBand ?? "Lớp 6–9",
          sourceId: source.id,
          provider: brief.provider ?? "LOCAL_TEMPLATE"
        })
      });
      setGeneratedLesson(result);
      setReviewQueue((items) => [result, ...items.filter((item) => item.id !== result.id)]);
      setMessage("AI đã lưu bản nháp vào Supabase");
      void apiRequest<TeacherDashboardData>("/teacher/dashboard").then(setTeacher).catch(() => undefined);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI không tạo được nội dung");
      throw cause;
    } finally { setBusy(false); setOperation(null); }
  }, [sources]);

  const selectGeneratedLesson = useCallback(async (id: string) => {
    setBusy(true);
    setOperation("Đang mở bản nội dung...");
    try { setGeneratedLesson(await apiRequest<MicroLesson>(`/teacher/generated-content/${id}`)); }
    finally { setBusy(false); setOperation(null); }
  }, []);

  const updateLesson = useCallback(async (draft: MicroLesson, teacherEditingSeconds = 0) => {
    setBusy(true);
    setOperation("Đang lưu phiên bản chỉnh sửa...");
    try {
      const result = await apiRequest<MicroLesson>(`/teacher/generated-content/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: draft.title,
          slides: draft.slides.map(({ id, title, body, narration }) => ({ id, title, body, narration })),
          quiz: draft.quiz,
          teacherEditingSeconds
        })
      });
      setGeneratedLesson(result);
      setReviewQueue((items) => items.map((item) => item.id === result.id ? result : item));
      setMessage("Đã lưu phiên bản giảng viên vào Supabase");
    } finally { setBusy(false); setOperation(null); }
  }, []);

  const transition = useCallback(async (action: "review" | "revision" | "approve" | "publish") => {
    if (!generatedLesson) return;
    setBusy(true);
    setOperation(action === "publish" ? "Đang xuất bản..." : "Đang cập nhật quy trình kiểm duyệt...");
    try {
      const comments = {
        review: "Gửi nội dung vào hàng chờ kiểm duyệt",
        revision: "Mở phiên bản mới để tiếp tục chỉnh sửa",
        approve: "Đã kiểm tra mục tiêu, nội dung, code, animation và đáp án",
        publish: "Cho phép học sinh truy cập phiên bản đã duyệt"
      };
      const result = await apiRequest<MicroLesson>(`/teacher/generated-content/${generatedLesson.id}/${action}`, { method: "POST", body: JSON.stringify({ comment: comments[action] }) });
      setGeneratedLesson(result);
      setReviewQueue((items) => [result, ...items.filter((item) => item.id !== result.id)]);
      setMessage(action === "publish" ? "Nội dung đã được xuất bản" : "Đã cập nhật trạng thái nội dung");
      void apiRequest<TeacherDashboardData>("/teacher/dashboard").then(setTeacher).catch(() => undefined);
    } finally { setBusy(false); setOperation(null); }
  }, [generatedLesson]);

  const completeQuiz = useCallback(async (selectedIndex: number, questionIndex = 0) => {
    if (!generatedLesson) throw new Error("Chưa có micro-lesson đã xuất bản");
    setBusy(true);
    setOperation("Đang chấm phần củng cố...");
    try {
      const result = await apiRequest<{ correct: boolean; masteryAfter: number }>(`/micro-lessons/${generatedLesson.id}/quiz`, { method: "POST", body: JSON.stringify({ selectedIndex, questionIndex }) });
      void refreshStudentSignals().catch(() => undefined);
      void apiRequest<ProgressData>("/students/me/progress").then(setProgress).catch(() => undefined);
      return result;
    } finally { setBusy(false); setOperation(null); }
  }, [generatedLesson, refreshStudentSignals]);

  const generateCoursePlan = useCallback(async (brief: CoursePlanBrief) => {
    setBusy(true);
    setOperation("AI đang phân tích nhu cầu và tổ hợp catalog khóa học...");
    setError(null);
    try {
      const result = await apiRequest<CoursePlanData>("/teacher/course-plans/generate", { method: "POST", body: JSON.stringify(brief) });
      setSelectedCoursePlan(result);
      setCoursePlans((items) => [result, ...items.filter((item) => item.id !== result.id)]);
      setMessage("AI đã lưu lộ trình khóa học dạng DRAFT vào Supabase");
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tạo được lộ trình khóa học");
      throw cause;
    } finally { setBusy(false); setOperation(null); }
  }, []);

  const selectCoursePlan = useCallback(async (id: string) => {
    setBusy(true);
    setOperation("Đang mở lộ trình khóa học...");
    try { setSelectedCoursePlan(await apiRequest<CoursePlanData>(`/teacher/course-plans/${id}`)); }
    finally { setBusy(false); setOperation(null); }
  }, []);

  const updateCoursePlan = useCallback(async (id: string, input: Partial<Pick<CoursePlanData, "title" | "gradeBand" | "goals" | "durationWeeks">> & { planJson?: Record<string, unknown> }) => {
    setBusy(true);
    setOperation("Đang lưu phiên bản lộ trình...");
    try {
      const result = await apiRequest<CoursePlanData>(`/teacher/course-plans/${id}`, { method: "PATCH", body: JSON.stringify(input) });
      setSelectedCoursePlan(result);
      setCoursePlans((items) => items.map((item) => item.id === result.id ? result : item));
    } finally { setBusy(false); setOperation(null); }
  }, []);

  const transitionCoursePlan = useCallback(async (action: "submit-review" | "approve" | "request-revision" | "publish") => {
    if (!selectedCoursePlan) return;
    setBusy(true);
    setOperation("Đang cập nhật quy trình duyệt lộ trình...");
    try {
      const result = await apiRequest<CoursePlanData>(`/teacher/course-plans/${selectedCoursePlan.id}/${action}`, { method: "POST", body: JSON.stringify({ comment: "Giảng viên đã kiểm tra phạm vi, thứ tự bài và mục tiêu lớp" }) });
      setSelectedCoursePlan(result);
      setCoursePlans((items) => items.map((item) => item.id === result.id ? result : item));
    } finally { setBusy(false); setOperation(null); }
  }, [selectedCoursePlan]);

  const logout = useCallback(() => {
    window.localStorage.removeItem("edurecall-access-token");
    window.localStorage.removeItem("edurecall-refresh-token");
    setRoleState(null);
    setReady(false);
  }, []);

  const value = useMemo<ProductContextValue>(() => ({
    role, busy, backgroundLoading, operation, ready, message, error, student, concepts, course, lesson, recommendations, reviews, progress, leaderboard, games, teacher, classData, heatmap, sources, reviewQueue, generatedLesson, coursePlans, selectedCoursePlan, analysis,
    setRole, refresh, openLesson, submitAttempt, generateLesson, selectGeneratedLesson, updateLesson,
    submitLessonReview: () => transition("review"), requestLessonRevision: () => transition("revision"), approveLesson: () => transition("approve"), publishLesson: () => transition("publish"),
    generateCoursePlan, selectCoursePlan, updateCoursePlan, transitionCoursePlan, completeQuiz, logout
  }), [role, busy, backgroundLoading, operation, ready, message, error, student, concepts, course, lesson, recommendations, reviews, progress, leaderboard, games, teacher, classData, heatmap, sources, reviewQueue, generatedLesson, coursePlans, selectedCoursePlan, analysis, setRole, refresh, openLesson, submitAttempt, generateLesson, selectGeneratedLesson, updateLesson, transition, generateCoursePlan, selectCoursePlan, updateCoursePlan, transitionCoursePlan, completeQuiz, logout]);

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProduct(): ProductContextValue {
  const value = useContext(ProductContext);
  if (!value) throw new Error("useProduct must be used inside ProductProvider");
  return value;
}
