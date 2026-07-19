"use client";

import type { MicroLesson } from "@edurecall/shared-types";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

export type LessonPhase = "THEORY" | "PRACTICE" | "CHECKPOINT";

export interface AuthIdentity {
  id: string;
  email: string;
  displayName: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
  avatar?: string | null;
  classRoles: Array<"OWNER" | "INSTRUCTOR" | "REVIEWER">;
}

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
export interface ExerciseOption { id: string; text: string }
export interface ExerciseCodeBlock { id: string; text: string }
export interface ExerciseData {
  id: string;
  code: string;
  type: string;
  prompt: string;
  difficulty: number;
  content: {
    responseMode?: "TEXT" | "MULTIPLE_CHOICE" | "PSEUDOCODE" | "CODE_ORDER";
    options?: Array<string | ExerciseOption>;
    blocks?: ExerciseCodeBlock[];
    guidance?: string;
    starterText?: string;
    syntaxPolicy?: string;
    [key: string]: unknown;
  };
}
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
  requestedBy: { id: string; displayName: string };
  updatedAt: string;
}
export interface CoursePlanBrief { courseId: string; classId?: string; className?: string; title?: string; gradeBand: string; goals: string[]; durationWeeks: number }

export type AttemptSubmission =
  | { kind: "TEXT" | "PSEUDOCODE"; text: string }
  | { kind: "CODE_ORDER"; blockIds: string[] };

export interface AttemptCriterionResult {
  id: string;
  coverage: number;
  evidence: string[];
  feedback: string;
}

export interface AttemptGradingDetails {
  strategy: "LEGACY_EXACT" | "IDEA_RUBRIC" | "CODE_ORDER";
  mode: "SERVER_ANSWER_KEY" | "EXTERNAL_LLM" | "DETERMINISTIC_RUBRIC_FALLBACK" | "DETERMINISTIC_CODE_ORDER";
  score: number;
  passThreshold: number;
  confidence: number;
  rubricVersion: string | null;
  criteria: AttemptCriterionResult[];
  feedback: string;
  trace?: {
    provider?: string;
    model?: string;
    promptVersion?: string;
    promptHash?: string;
    promptTokens?: number;
    completionTokens?: number;
    estimatedCostUsd?: number;
    latencyMs?: number;
    fallbackReason?: string;
  };
}

export interface AttemptOutcome {
  analysis: AnalysisResult;
  isCorrect: boolean;
  attemptId: string;
  grading?: AttemptGradingDetails;
}

interface ProductContextValue {
  role: "student" | "teacher" | null;
  busy: boolean;
  backgroundLoading: boolean;
  operation: string | null;
  ready: boolean;
  message: string;
  error: string | null;
  identity: AuthIdentity | null;
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
  submitAttempt: (exercise: ExerciseData, submission: AttemptSubmission, phase?: LessonPhase, responseTimeMs?: number, idempotencyKey?: string) => Promise<AttemptOutcome>;
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
  completeQuiz: (selectedIndex: number, questionIndex?: number) => Promise<{ correct: boolean; masteryAfter: number; explanation: string }>;
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
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
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
  const sessionGeneration = useRef(0);

  const refreshStudentSignals = useCallback(async () => {
    const generation = sessionGeneration.current;
    const [dashboard, conceptRows, recommendationRows, reviewRows] = await Promise.all([
      apiRequest<StudentDashboardData>("/students/me/dashboard"),
      apiRequest<ConceptData[]>("/students/me/concepts"),
      apiRequest<RecommendationData[]>("/students/me/recommendations"),
      apiRequest<ReviewData>("/students/me/reviews")
    ]);
    if (sessionGeneration.current !== generation) return reviewRows;
    setStudent(dashboard);
    setConcepts(conceptRows);
    setRecommendations(recommendationRows);
    setReviews(reviewRows);
    return reviewRows;
  }, []);

  const loadStudent = useCallback(async (generation: number) => {
    const [dashboard, conceptRows, recommendationRows, reviewRows] = await Promise.all([
      apiRequest<StudentDashboardData>("/students/me/dashboard"),
      apiRequest<ConceptData[]>("/students/me/concepts"),
      apiRequest<RecommendationData[]>("/students/me/recommendations"),
      apiRequest<ReviewData>("/students/me/reviews")
    ]);
    if (sessionGeneration.current !== generation) return;
    setStudent(dashboard);
    setConcepts(conceptRows);
    setRecommendations(recommendationRows);
    setReviews(reviewRows);

    setBackgroundLoading(true);
    const courseRequest = apiRequest<CourseData>(`/courses/${dashboard.course.id}`).then((courseRow) => {
      if (sessionGeneration.current !== generation) return;
      setCourse(courseRow);
      const lessons = courseRow.modules.flatMap((item) => item.lessons);
      const currentLesson = lessons.find((item) => item.status === "CURRENT")
        ?? lessons.find((item) => item.status === "NOT_STARTED" || item.status === "AVAILABLE")
        ?? lessons[0];
      if (!currentLesson) return;
      activeLessonId.current ??= currentLesson.id;
      return apiRequest<LessonData>(`/lessons/${currentLesson.id}`).then((row) => {
        if (sessionGeneration.current === generation && activeLessonId.current === currentLesson.id) setLesson(row);
      });
    });

    const progressRequest = apiRequest<ProgressData>("/students/me/progress").then((row) => { if (sessionGeneration.current === generation) setProgress(row); });
    const leaderboardRequest = apiRequest<LeaderboardData>("/students/me/leaderboard").then((row) => { if (sessionGeneration.current === generation) setLeaderboard(row); });
    const gamesRequest = apiRequest<Array<Record<string, unknown>>>("/games").then((rows) => { if (sessionGeneration.current === generation) setGames(rows); });
    const publishedId = reviewRows.due[0]?.id;
    const publishedRequest = publishedId
      ? apiRequest<MicroLesson>(`/micro-lessons/${publishedId}`).then((row) => { if (sessionGeneration.current === generation) setGeneratedLesson(row); })
      : Promise.resolve();
    void Promise.allSettled([courseRequest, progressRequest, leaderboardRequest, gamesRequest, publishedRequest])
      .finally(() => { if (sessionGeneration.current === generation) setBackgroundLoading(false); });
  }, []);

  const loadTeacher = useCallback(async (generation: number) => {
    const [dashboard, sourceRows, queue, plans] = await Promise.all([
      apiRequest<TeacherDashboardData>("/teacher/dashboard"),
      apiRequest<SourceData[]>("/content-sources"),
      apiRequest<MicroLesson[]>("/teacher/reviews"),
      apiRequest<CoursePlanData[]>("/teacher/course-plans")
    ]);
    if (sessionGeneration.current !== generation) return;
    setTeacher(dashboard);
    setSources(sourceRows);
    setReviewQueue(queue);
    setGeneratedLesson((current) => current && queue.some((item) => item.id === current.id) ? queue.find((item) => item.id === current.id) ?? current : queue[0] ?? null);
    setCoursePlans(plans);
    setSelectedCoursePlan((current) => current && plans.some((item) => item.id === current.id) ? plans.find((item) => item.id === current.id) ?? current : plans[0] ?? null);
    setBackgroundLoading(true);
    const classRequest = apiRequest<ClassData>(`/teacher/classes/${dashboard.class.id}`).then(async (detail) => {
      if (sessionGeneration.current !== generation) return;
      setClassData(detail);
      if (detail.course?.id) {
        const row = await apiRequest<CourseData>(`/courses/${detail.course.id}`);
        if (sessionGeneration.current === generation) setCourse(row);
      }
    });
    const heatmapRequest = apiRequest<HeatmapData>(`/teacher/classes/${dashboard.class.id}/heatmap`).then((row) => { if (sessionGeneration.current === generation) setHeatmap(row); });
    void Promise.allSettled([classRequest, heatmapRequest]).finally(() => { if (sessionGeneration.current === generation) setBackgroundLoading(false); });
  }, []);

  const load = useCallback(async (targetRole: "student" | "teacher", generation: number) => {
    setBusy(true);
    setOperation("Đang tải dữ liệu từ Supabase...");
    setError(null);
    try {
      const [authenticatedIdentity] = await Promise.all([
        apiRequest<AuthIdentity>("/auth/me"),
        targetRole === "student" ? loadStudent(generation) : loadTeacher(generation)
      ]);
      if (sessionGeneration.current !== generation) return;
      setIdentity(authenticatedIdentity);
      setMessage("Dữ liệu trực tiếp từ Supabase");
      setReady(true);
    } catch (cause) {
      if (sessionGeneration.current !== generation) return;
      setReady(false);
      setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu từ API");
      setMessage("Mất kết nối API/Supabase");
      throw cause;
    } finally {
      if (sessionGeneration.current === generation) {
        setBusy(false);
        setOperation(null);
      }
    }
  }, [loadStudent, loadTeacher]);

  const setRole = useCallback(async (nextRole: "student" | "teacher") => {
    if (role === nextRole && ready) return;
    if (inFlightRole.current?.role === nextRole) return inFlightRole.current.promise;
    const generation = ++sessionGeneration.current;
    setRoleState(nextRole);
    const promise = load(nextRole, generation).finally(() => {
      if (sessionGeneration.current === generation) inFlightRole.current = null;
    });
    inFlightRole.current = { role: nextRole, promise };
    return promise;
  }, [load, ready, role]);

  const refresh = useCallback(async () => {
    if (!role) return;
    const generation = ++sessionGeneration.current;
    await load(role, generation);
  }, [load, role]);

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

  const submitAttempt = useCallback(async (exercise: ExerciseData, submission: AttemptSubmission, _phase: LessonPhase = "PRACTICE", responseTimeMs = 0, idempotencyKey?: string): Promise<AttemptOutcome> => {
    if (!course?.id) throw new Error("Khóa học đang tải; hãy đợi vài giây rồi nộp lại");
    const generation = sessionGeneration.current;
    setBusy(true);
    setOperation(submission.kind === "PSEUDOCODE" ? "Đang đánh giá ý tưởng và cập nhật lộ trình..." : "Server đang chấm và cập nhật lộ trình...");
    setError(null);
    try {
      const result = await apiRequest<{ id: string; isCorrect: boolean; analysis: AnalysisResult; grading?: AttemptGradingDetails }>("/attempts", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: idempotencyKey ?? `${exercise.code}-${crypto.randomUUID()}`,
          courseId: course.id,
          activityId: exercise.id,
          submission,
          usedHint: false,
          skipped: false,
          responseTimeMs: Math.max(0, Math.min(3_600_000, Math.round(responseTimeMs)))
        })
      });
      if (sessionGeneration.current !== generation) throw new Error("Phiên đăng nhập đã thay đổi; kết quả cũ đã bị bỏ qua");
      setAnalysis(result.analysis);
      setMessage(`Server đã chấm và phân tích attempt ${result.id.slice(0, 8)}`);
      void refreshStudentSignals().then((reviewRows) => {
        const publishedId = reviewRows.due[0]?.id;
        if (publishedId) void apiRequest<MicroLesson>(`/micro-lessons/${publishedId}`).then(setGeneratedLesson).catch(() => undefined);
      }).catch(() => undefined);
      void apiRequest<ProgressData>("/students/me/progress").then(setProgress).catch(() => undefined);
      if (course?.id) void apiRequest<CourseData>(`/courses/${course.id}`).then(setCourse).catch(() => undefined);
      return { analysis: result.analysis, isCorrect: result.isCorrect, attemptId: result.id, grading: result.grading };
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Không ghi được attempt";
      setError(text);
      throw cause;
    } finally {
      if (sessionGeneration.current === generation) {
        setBusy(false);
        setOperation(null);
      }
    }
  }, [course?.id, refreshStudentSignals]);

  const generateLesson = useCallback(async (briefOrKind: GenerationBrief | "FULL_LESSON" | "REMEDIATION" = "FULL_LESSON") => {
    const brief: GenerationBrief = typeof briefOrKind === "string" ? { draftKind: briefOrKind } : briefOrKind;
    if (!brief.conceptCode) throw new Error("Hãy chọn một bài học thật trước khi tạo bản nháp");
    if (brief.draftKind === "REMEDIATION" && !brief.misconceptionCode) {
      throw new Error("Bài bổ trợ phải chọn một misconception thuộc concept đang dạy");
    }
    if (!brief.sourceId) throw new Error("Hãy chọn một nguồn học liệu đã xác minh");
    const source = sources.find((item) => item.id === brief.sourceId && item.status === "VERIFIED");
    if (!source) throw new Error("Nguồn đã chọn không tồn tại hoặc chưa được xác minh");
    setBusy(true);
    setOperation(brief.provider === "EXTERNAL_LLM" ? "External LLM đang dựng bản nháp từ nguồn đã xác minh..." : "Local Template đang dựng khung bài học xác định...");
    setError(null);
    try {
      const result = await apiRequest<MicroLesson>("/ai/content/generate", {
        method: "POST",
        body: JSON.stringify({
          domainCode: "python-foundations",
          conceptCode: brief.conceptCode,
          ...(brief.misconceptionCode ? { misconceptionCode: brief.misconceptionCode } : {}),
          level: brief.level ?? "Mới bắt đầu",
          learningObjective: brief.learningObjective ?? "Giải thích được ý tưởng cốt lõi và áp dụng trong một tình huống mới",
          durationMinutes: brief.durationMinutes ?? (brief.draftKind === "FULL_LESSON" ? 65 : 12),
          draftKind: brief.draftKind,
          gradeBand: brief.gradeBand ?? "Lớp 6–9",
          sourceId: source.id,
          provider: brief.provider ?? "LOCAL_TEMPLATE"
        })
      });
      setGeneratedLesson(result);
      setReviewQueue((items) => [result, ...items.filter((item) => item.id !== result.id)]);
      setMessage("Bản nháp đã được lưu vào Supabase để giáo viên kiểm duyệt");
      void apiRequest<TeacherDashboardData>("/teacher/dashboard").then(setTeacher).catch(() => undefined);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tạo được bản nháp nội dung");
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
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Không cập nhật được quy trình kiểm duyệt";
      setError(text);
      setMessage("Quy trình kiểm duyệt chưa thay đổi");
    } finally { setBusy(false); setOperation(null); }
  }, [generatedLesson]);

  const completeQuiz = useCallback(async (selectedIndex: number, questionIndex = 0) => {
    if (!generatedLesson) throw new Error("Chưa có micro-lesson đã xuất bản");
    setBusy(true);
    setOperation("Đang chấm phần củng cố...");
    try {
      const result = await apiRequest<{ correct: boolean; masteryAfter: number; explanation: string }>(`/micro-lessons/${generatedLesson.id}/quiz`, { method: "POST", body: JSON.stringify({ selectedIndex, questionIndex }) });
      void refreshStudentSignals().catch(() => undefined);
      void apiRequest<ProgressData>("/students/me/progress").then(setProgress).catch(() => undefined);
      return result;
    } finally { setBusy(false); setOperation(null); }
  }, [generatedLesson, refreshStudentSignals]);

  const generateCoursePlan = useCallback(async (brief: CoursePlanBrief) => {
    setBusy(true);
    setOperation("LOCAL_CATALOG_PLANNER đang chấm catalog và chia bài theo tuần...");
    setError(null);
    try {
      const result = await apiRequest<CoursePlanData>("/teacher/course-plans/generate", { method: "POST", body: JSON.stringify(brief) });
      setSelectedCoursePlan(result);
      setCoursePlans((items) => [result, ...items.filter((item) => item.id !== result.id)]);
      setMessage("Bộ lập kế hoạch xác định đã lưu bản nháp vào Supabase");
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
      setError(null);
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Không cập nhật được quy trình duyệt lộ trình";
      setError(text);
      setMessage("Quy trình duyệt lộ trình chưa thay đổi");
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
      setError(null);
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Không cập nhật được quy trình duyệt lộ trình";
      setError(text);
      setMessage("Quy trình duyệt lộ trình chưa thay đổi");
    } finally { setBusy(false); setOperation(null); }
  }, [selectedCoursePlan]);

  const logout = useCallback(() => {
    sessionGeneration.current += 1;
    inFlightRole.current = null;
    activeLessonId.current = null;
    window.localStorage.removeItem("edurecall-access-token");
    window.localStorage.removeItem("edurecall-refresh-token");
    setRoleState(null);
    setReady(false);
    setBusy(false);
    setBackgroundLoading(false);
    setOperation(null);
    setError(null);
    setIdentity(null);
    setMessage("Chưa đăng nhập");
    setStudent(null);
    setConcepts([]);
    setCourse(null);
    setLesson(null);
    setRecommendations([]);
    setReviews(null);
    setProgress(null);
    setLeaderboard(null);
    setGames([]);
    setTeacher(null);
    setClassData(null);
    setHeatmap(null);
    setSources([]);
    setReviewQueue([]);
    setGeneratedLesson(null);
    setCoursePlans([]);
    setSelectedCoursePlan(null);
    setAnalysis(null);
  }, []);

  const value = useMemo<ProductContextValue>(() => ({
    role, busy, backgroundLoading, operation, ready, message, error, identity, student, concepts, course, lesson, recommendations, reviews, progress, leaderboard, games, teacher, classData, heatmap, sources, reviewQueue, generatedLesson, coursePlans, selectedCoursePlan, analysis,
    setRole, refresh, openLesson, submitAttempt, generateLesson, selectGeneratedLesson, updateLesson,
    submitLessonReview: () => transition("review"), requestLessonRevision: () => transition("revision"), approveLesson: () => transition("approve"), publishLesson: () => transition("publish"),
    generateCoursePlan, selectCoursePlan, updateCoursePlan, transitionCoursePlan, completeQuiz, logout
  }), [role, busy, backgroundLoading, operation, ready, message, error, identity, student, concepts, course, lesson, recommendations, reviews, progress, leaderboard, games, teacher, classData, heatmap, sources, reviewQueue, generatedLesson, coursePlans, selectedCoursePlan, analysis, setRole, refresh, openLesson, submitAttempt, generateLesson, selectGeneratedLesson, updateLesson, transition, generateCoursePlan, selectCoursePlan, updateCoursePlan, transitionCoursePlan, completeQuiz, logout]);

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProduct(): ProductContextValue {
  const value = useContext(ProductContext);
  if (!value) throw new Error("useProduct must be used inside ProductProvider");
  return value;
}
