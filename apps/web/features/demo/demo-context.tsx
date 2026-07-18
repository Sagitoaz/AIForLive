"use client";

import type { MicroLesson } from "@edurecall/shared-types";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

export interface DemoAnalysis {
  mode: "AI_SERVICE" | "DETERMINISTIC_FALLBACK";
  mastery_before: number;
  mastery_after: number;
  retrievability: number;
  forgetting_risk: number;
  recommended_interval_days: number;
  diagnosis: {
    status: string;
    misconception_code: string | null;
    confidence: number;
    rule_id: string | null;
    evidence: string[];
  };
  recommendation: {
    action: string;
    priority_score: number;
    reasons: string[];
    evidence: Record<string, unknown>;
    target?: {
      type: "LESSON_PHASE" | "ACTIVITY" | "MICRO_LESSON";
      id: string;
      title: string;
      phase: "THEORY" | "PRACTICE" | "CHECKPOINT";
      estimated_minutes: number;
      difficulty?: number;
    };
  };
  explanations: string[];
}

interface StoredDemoState {
  role: "student" | "teacher";
  mastery: number;
  masteryBeforeReview: number;
  xp: number;
  attemptId: string | null;
  analysis: DemoAnalysis | null;
  lesson: MicroLesson | null;
  quizCompleted: boolean;
  lastMessage: string;
  learningLog: Array<{
    id: string;
    activityId: string;
    phase: "PRACTICE" | "CHECKPOINT";
    isCorrect: boolean;
    occurredAt: string;
    recommendationTargetId?: string;
  }>;
}

export interface LearningAttemptInput {
  activityId: string;
  phase: "PRACTICE" | "CHECKPOINT";
  isCorrect: boolean;
  submittedAnswer: string;
  expectedAnswer: string;
  difficulty: number;
  responseTimeMs: number;
  stopValue?: number;
}

interface DemoContextValue extends StoredDemoState {
  busy: boolean;
  setRole: (role: "student" | "teacher") => void;
  submitRangeMistake: () => Promise<void>;
  submitLearningAttempt: (input: LearningAttemptInput) => Promise<void>;
  generateLesson: (kind?: "FULL_LESSON" | "REMEDIATION") => Promise<void>;
  updateLesson: (lesson: MicroLesson) => Promise<void>;
  approveLesson: () => Promise<void>;
  publishLesson: () => Promise<void>;
  completeQuiz: (selectedIndex: number) => Promise<{ correct: boolean; masteryAfter: number }>;
  resetDemo: () => void;
}

const initialState: StoredDemoState = {
  role: "student",
  mastery: 0.42,
  masteryBeforeReview: 0.42,
  xp: 860,
  attemptId: null,
  analysis: null,
  lesson: null,
  quizCompleted: false,
  lastMessage: "Demo sẵn sàng",
  learningLog: []
};

interface ContentWorkflowTiming {
  generationMs: number;
  teacherEditingSeconds: number;
  workflowStartedAt: string;
}

function withTeacherElapsed(lesson: MicroLesson, now = Date.now()): MicroLesson {
  const parsedStart = lesson.workflowStartedAt ? Date.parse(lesson.workflowStartedAt) : Number.NaN;
  const workflowStartedAt = Number.isFinite(parsedStart) && lesson.workflowStartedAt
    ? lesson.workflowStartedAt
    : new Date(now).toISOString();
  const startedAt = Number.isFinite(parsedStart) ? parsedStart : now;
  const generationMs = Math.max(0, lesson.generationMs ?? 0);
  const teacherElapsedMs = Math.max(0, now - startedAt - generationMs);
  const elapsedTeacherSeconds = Math.round(teacherElapsedMs / 100) / 10;
  return {
    ...lesson,
    generationMs,
    workflowStartedAt,
    teacherEditingSeconds: Math.max(lesson.teacherEditingSeconds ?? 0, elapsedTeacherSeconds)
  };
}

const localLesson = (timing: ContentWorkflowTiming, draftKind: "FULL_LESSON" | "REMEDIATION" = "REMEDIATION"): MicroLesson => ({
  id: `local-draft-${crypto.randomUUID()}`,
  title: "Dừng đúng lúc với range()",
  domainCode: "python-foundations",
  conceptCode: "PYTHON_RANGE",
  misconceptionCode: "RANGE_STOP_INCLUDED",
  level: "Mới bắt đầu",
  gradeBand: "Lớp 6–9",
  draftKind,
  totalDurationMinutes: draftKind === "FULL_LESSON" ? 65 : 7,
  objectives: ["Biết stop không thuộc dãy", "Tự sửa đáp án có stop", "Áp dụng vào dãy mới"],
  sourceReferences: ["source-python-handbook-01"],
  slides: [
    {
      id: "slide-concept",
      order: 1,
      type: "CONCEPT",
      title: "Ba mốc của range",
      body: "range(start, stop) bắt đầu ở start và dừng ngay trước stop. Hãy coi stop như vạch đích.",
      code: "range(1, 5)",
      narration: "Số ở mốc dừng không đi vào dãy.",
      animationTemplate: "NUMBER_SEQUENCE",
      animationData: { start: 1, stop: 5, values: ["1", "2", "3", "4"] }
    },
    {
      id: "slide-example",
      order: 2,
      type: "EXAMPLE",
      title: "Mầm bước bốn ô",
      body: "Mầm ghé 1, 2, 3, 4. Ô số 5 là biển STOP nên không được ghé.",
      code: "for n in range(1, 5):\n    print(n)",
      narration: "Khi thấy biển số năm, Mầm dừng lại.",
      animationTemplate: "LOOP_TIMELINE",
      animationData: { iterations: 4, values: ["1", "2", "3", "4"] }
    },
    {
      id: "slide-misconception",
      order: 3,
      type: "MISCONCEPTION",
      title: "Bẫy stop được lấy",
      body: "Nếu muốn nhận cả 5, điểm dừng phải là 6.",
      code: "list(range(1, 6))  # [1, 2, 3, 4, 5]",
      narration: "Đặt điểm dừng sau số cuối bạn muốn lấy.",
      animationTemplate: "BUG_REVEAL",
      animationData: { wrongLine: "range(1, 5) → ... 5", fixedLine: "range(1, 6) → ... 5", message: "stop is exclusive" }
    },
    {
      id: "slide-summary",
      order: 4,
      type: "SUMMARY",
      title: "Công thức nhớ nhanh",
      body: "Bắt đầu tại start, tăng theo step và dừng trước stop.",
      narration: "Bắt đầu ở start, dừng trước stop.",
      animationTemplate: "NUMBER_SEQUENCE",
      animationData: { start: 1, stop: 5, values: ["start ✓", "2", "3", "4", "stop ✕"] }
    }
  ],
  quiz: {
    question: "list(range(2, 6)) cho kết quả nào?",
    options: ["[2, 3, 4, 5]", "[2, 3, 4, 5, 6]", "[1, 2, 3, 4, 5]"],
    correctIndex: 0,
    explanation: "Dãy bắt đầu ở 2 và dừng trước 6, nên phần tử cuối là 5."
  },
  sections: [
    { phase: "THEORY", title: "Lý thuyết có minh họa", durationMinutes: draftKind === "FULL_LESSON" ? 23 : 3, summary: "Bài giảng, video và phiếu đọc về start, stop, step.", activityTypes: ["LECTURE", "VIDEO", "DOCUMENT"] },
    { phase: "PRACTICE", title: "Thực hành có phản hồi", durationMinutes: draftKind === "FULL_LESSON" ? 29 : 3, summary: "Dự đoán output, chạy code và sửa lỗi lệch một đơn vị.", activityTypes: ["CODE", "MULTIPLE_CHOICE", "DEBUG"] },
    { phase: "CHECKPOINT", title: "Kiểm tra cuối bài", durationMinutes: draftKind === "FULL_LESSON" ? 13 : 1, summary: "Ba tình huống mới dùng để cập nhật mastery và lộ trình.", activityTypes: ["MULTIPLE_CHOICE", "CODE"] }
  ],
  status: "DRAFT",
  provider: "LOCAL_TEMPLATE",
  reuseCount: 0,
  version: 1,
  ...timing
});

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoredDemoState>(initialState);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("edurecall-demo-v1");
    if (stored) {
      try {
        setState({ ...initialState, ...(JSON.parse(stored) as Partial<StoredDemoState>) });
      } catch {
        window.localStorage.removeItem("edurecall-demo-v1");
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("edurecall-demo-v1", JSON.stringify(state));
  }, [state]);

  const setRole = useCallback((role: "student" | "teacher") => {
    setState((current) => ({ ...current, role, lastMessage: role === "teacher" ? "Đã chuyển sang Teacher workspace" : "Đã chuyển sang Student workspace" }));
  }, []);

  const submitRangeMistake = useCallback(async () => {
    setBusy(true);
    const key = `range-${crypto.randomUUID()}`;
    try {
      const result = await apiRequest<{ id: string; analysis: DemoAnalysis }>("/attempts", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: key,
          studentId: "student-minh",
          domainCode: "python-foundations",
          courseId: "course-python",
          conceptCode: "PYTHON_RANGE",
          activityId: "practice-range-predict-01",
          lessonPhase: "PRACTICE",
          isCorrect: false,
          usedHint: false,
          skipped: false,
          attemptNumber: 1,
          difficulty: 0.45,
          responseTimeMs: 12_500,
          submittedAnswer: "1, 2, 3, 4, 5",
          expectedAnswer: "1, 2, 3, 4",
          stopValue: 5,
          prerequisiteMastery: 0.72
        })
      });
      setState((current) => ({ ...current, attemptId: result.id, analysis: result.analysis, mastery: result.analysis.mastery_after, learningLog: [...current.learningLog, { id: result.id, activityId: "practice-range-predict-01", phase: "PRACTICE", isCorrect: false, occurredAt: new Date().toISOString(), recommendationTargetId: result.analysis.recommendation.target?.id }], lastMessage: result.analysis.mode === "AI_SERVICE" ? "Python AI service đã phân tích attempt" : "API đang dùng personalization fallback mode" }));
    } catch {
      const analysis: DemoAnalysis = {
        mode: "DETERMINISTIC_FALLBACK",
        mastery_before: 0.42,
        mastery_after: 0.35,
        retrievability: 0.39,
        forgetting_risk: 0.61,
        recommended_interval_days: 1,
        diagnosis: {
          status: "MATCHED",
          misconception_code: "RANGE_STOP_INCLUDED",
          confidence: 0.95,
          rule_id: "range-stop-rule-v1",
          evidence: ["Submitted sequence contains the stop value", "Expected sequence excludes the stop value"]
        },
        recommendation: {
          action: "MICRO_LESSON",
          priority_score: 0.87,
          reasons: ["Mastery của concept hiện ở mức 35%", "Đáp án hiện tại chứa giá trị stop nên khớp rule RANGE_STOP_INCLUDED", "Retrievability ước tính còn 39%", "Concept này cần cho bài vòng lặp tiếp theo"],
          evidence: {
            attemptIds: [key],
            modelVersion: "fallback-v1",
            ruleId: "range-stop-rule-v1",
            candidateScores: { knowledgeGap: 0.65, forgettingRisk: 0.61, recentErrorRate: 1, prerequisiteGap: 0.28 },
            selectedBecause: "MICRO_LESSON"
          },
          target: { type: "MICRO_LESSON", id: "python_range-range_stop_included-v1", title: "Bài bổ trợ: Stop không thuộc range()", phase: "THEORY", estimated_minutes: 5, difficulty: 0.35 }
        },
        explanations: ["Knowledge tracing đo mức hiểu", "Forgetting model đo nguy cơ quên", "Recommendation chọn hoạt động từ signal thật"]
      };
      setState((current) => ({ ...current, attemptId: key, analysis, mastery: analysis.mastery_after, learningLog: [...current.learningLog, { id: key, activityId: "practice-range-predict-01", phase: "PRACTICE", isCorrect: false, occurredAt: new Date().toISOString(), recommendationTargetId: analysis.recommendation.target?.id }], lastMessage: "Personalization fallback mode — attempt vẫn được lưu trong demo" }));
    } finally {
      setBusy(false);
    }
  }, []);

  const submitLearningAttempt = useCallback(async (input: LearningAttemptInput) => {
    setBusy(true);
    const key = `${input.activityId}-${crypto.randomUUID()}`;
    try {
      const result = await apiRequest<{ id: string; analysis: DemoAnalysis }>("/attempts", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: key,
          studentId: "student-minh",
          domainCode: "python-foundations",
          courseId: "course-python",
          conceptCode: "PYTHON_RANGE",
          activityId: input.activityId,
          lessonPhase: input.phase,
          isCorrect: input.isCorrect,
          usedHint: false,
          skipped: false,
          attemptNumber: 1,
          difficulty: input.difficulty,
          responseTimeMs: input.responseTimeMs,
          submittedAnswer: input.submittedAnswer,
          expectedAnswer: input.expectedAnswer,
          stopValue: input.stopValue,
          prerequisiteMastery: 0.72
        })
      });
      setState((current) => ({
        ...current,
        attemptId: result.id,
        analysis: result.analysis,
        mastery: result.analysis.mastery_after,
        learningLog: [...current.learningLog, { id: result.id, activityId: input.activityId, phase: input.phase, isCorrect: input.isCorrect, occurredAt: new Date().toISOString(), recommendationTargetId: result.analysis.recommendation.target?.id }],
        lastMessage: `Đã ghi ${input.phase.toLowerCase()} event và cập nhật recommendation`
      }));
    } catch {
      const masteryAfter = Math.max(0.02, Math.min(0.98, state.mastery + (input.isCorrect ? 0.08 : -0.05)));
      const action = input.isCorrect ? (input.phase === "CHECKPOINT" ? "CONTINUE_PATH" : "CHECKPOINT") : "PRACTICE_SET";
      const analysis: DemoAnalysis = {
        mode: "DETERMINISTIC_FALLBACK",
        mastery_before: state.mastery,
        mastery_after: masteryAfter,
        retrievability: Math.max(0.2, masteryAfter - 0.06),
        forgetting_risk: Math.min(0.8, 1.02 - masteryAfter),
        recommended_interval_days: input.isCorrect ? 5 : 1,
        diagnosis: { status: input.isCorrect ? "NO_ERROR" : "NEED_MORE_EVIDENCE", misconception_code: null, confidence: input.isCorrect ? 0.8 : 0.35, rule_id: null, evidence: ["Registered activity was scored deterministically", "No misconception rule was confirmed"] },
        recommendation: {
          action,
          priority_score: input.isCorrect ? 0.48 : 0.72,
          reasons: [input.isCorrect ? "Học sinh vừa hoàn thành hoạt động đã đăng ký" : "Kết quả chưa đạt ngưỡng nhưng chưa đủ evidence gắn misconception", `Mastery range() hiện ở mức ${Math.round(masteryAfter * 100)}%`],
          evidence: { attemptIds: [key], modelVersion: "fallback-v1", ruleId: null, candidateScores: { knowledgeGap: 1 - masteryAfter, checkpointResult: input.isCorrect } },
          target: input.isCorrect && input.phase === "CHECKPOINT"
            ? { type: "LESSON_PHASE", id: "lesson-09-theory", title: "while và điều kiện dừng", phase: "THEORY", estimated_minutes: 18, difficulty: 0.6 }
            : { type: "ACTIVITY", id: "python_range-guided-practice", title: "Bộ luyện có gợi ý: range()", phase: "PRACTICE", estimated_minutes: 10, difficulty: 0.5 }
        },
        explanations: ["Registered activity is scored on the server when the API is available", "Fallback still records an explicit target and evidence"]
      };
      setState((current) => ({ ...current, attemptId: key, analysis, mastery: masteryAfter, learningLog: [...current.learningLog, { id: key, activityId: input.activityId, phase: input.phase, isCorrect: input.isCorrect, occurredAt: new Date().toISOString(), recommendationTargetId: analysis.recommendation.target?.id }], lastMessage: "Đã ghi event bằng personalization fallback có nhãn" }));
    } finally {
      setBusy(false);
    }
  }, [state.mastery]);

  const generateLesson = useCallback(async (kind: "FULL_LESSON" | "REMEDIATION" = "REMEDIATION") => {
    setBusy(true);
    const workflowStartedAt = new Date().toISOString();
    const generationStartedAt = performance.now();
    try {
      const result = await apiRequest<MicroLesson>("/ai/content/generate", {
        method: "POST",
        body: JSON.stringify({
          domainCode: "python-foundations",
          conceptCode: "PYTHON_RANGE",
          misconceptionCode: "RANGE_STOP_INCLUDED",
          level: "Mới bắt đầu",
          learningObjective: kind === "FULL_LESSON" ? "Đọc đúng start, stop, step và áp dụng range() trong vòng lặp" : "Biết rằng stop không thuộc dãy",
          durationMinutes: kind === "FULL_LESSON" ? 65 : 7,
          draftKind: kind,
          gradeBand: "Lớp 6–9",
          sourceId: "source-python-handbook-01",
        })
      });
      const generationMs = Math.max(1, Math.round(performance.now() - generationStartedAt));
      setState((current) => ({
        ...current,
        lesson: { ...result, generationMs, teacherEditingSeconds: 0, workflowStartedAt },
        lastMessage: result.reuseCount > 0
          ? "Đã tái sử dụng nội dung được duyệt"
          : result.provider === "EXTERNAL_LLM"
            ? "FPT DeepSeek-V4-Flash đã tạo JSON hợp lệ ở trạng thái DRAFT"
            : "Local demo provider đã tạo JSON hợp lệ ở trạng thái DRAFT"
      }));
    } catch {
      const generationMs = Math.max(1, Math.round(performance.now() - generationStartedAt));
      setState((current) => ({
        ...current,
        lesson: localLesson({ generationMs, teacherEditingSeconds: 0, workflowStartedAt }, kind),
        lastMessage: "FPT AI không khả dụng; trình duyệt chuyển sang bản nháp local và ghi rõ fallback"
      }));
    } finally {
      setBusy(false);
    }
  }, []);

  const updateLesson = useCallback(async (lesson: MicroLesson) => {
    setBusy(true);
    const isLocalDraft = lesson.id.startsWith("local-draft-");
    try {
      if (state.lesson?.id && !isLocalDraft) {
        await apiRequest(`/teacher/generated-content/${state.lesson.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: lesson.title, slides: lesson.slides.map(({ id, title, body, narration }) => ({ id, title, body, narration })), quiz: lesson.quiz })
        });
      }
      setState((current) => ({
        ...current,
        lesson: withTeacherElapsed({ ...lesson, version: lesson.version + 1 }),
        lastMessage: isLocalDraft ? "Đã lưu bản sửa trong phiên demo cục bộ; chưa ghi lên server" : "Đã lưu chỉnh sửa và validate lại toàn bộ bài"
      }));
    } catch {
      setState((current) => ({ ...current, lastMessage: "Không lưu được lên server; bản đang sửa chưa được đánh dấu là đã lưu" }));
    } finally {
      setBusy(false);
    }
  }, [state.lesson?.id]);

  const transition = useCallback(async (action: "approve" | "publish") => {
    if (!state.lesson) return;
    setBusy(true);
    const isLocalDraft = state.lesson.id.startsWith("local-draft-");
    let transitionSucceeded = isLocalDraft;
    try {
      if (!isLocalDraft) {
        await apiRequest(`/teacher/generated-content/${state.lesson.id}/${action}`, { method: "POST", body: JSON.stringify({ comment: action === "approve" ? "Đã kiểm tra tính chính xác" : "Sẵn sàng cho học viên" }) });
        transitionSucceeded = true;
      }
    } catch {
      setState((current) => ({ ...current, lastMessage: `Không thể ${action === "approve" ? "phê duyệt" : "xuất bản"} trên server; trạng thái không thay đổi` }));
    } finally {
      if (transitionSucceeded) {
        setState((current) => current.lesson ? {
          ...current,
          lesson: withTeacherElapsed({
            ...current.lesson,
            status: action === "approve" ? "APPROVED" : "PUBLISHED",
            version: current.lesson.version + 1
          }),
          lastMessage: isLocalDraft
            ? action === "approve" ? "Giáo viên đã duyệt bản local trong phiên demo" : "Đã xuất bản trong phiên demo cục bộ; server không thay đổi"
            : action === "approve" ? "Nội dung đã APPROVED trên server" : "Nội dung đã PUBLISHED cho học viên"
        } : current);
      }
      setBusy(false);
    }
  }, [state.lesson]);

  const completeQuiz = useCallback(async (selectedIndex: number) => {
    if (!state.lesson) return { correct: false, masteryAfter: state.mastery };
    setBusy(true);
    const correct = selectedIndex === state.lesson.quiz.correctIndex;
    let masteryAfter = Math.max(0.02, Math.min(0.98, state.mastery + (correct ? 0.14 : -0.04)));
    try {
      const result = await apiRequest<{ correct: boolean; masteryAfter: number }>(`/micro-lessons/${state.lesson.id}/quiz`, { method: "POST", body: JSON.stringify({ selectedIndex }) });
      masteryAfter = result.masteryAfter;
    } catch {
      // Same deterministic update is used for the offline judging path.
    } finally {
      setState((current) => ({ ...current, masteryBeforeReview: current.mastery, mastery: masteryAfter, xp: current.xp + (correct ? 40 : 12), quizCompleted: true, lastMessage: correct ? "Mastery tăng và review interval chuyển thành 5 ngày" : "Đã lên lịch ôn lại vào ngày mai" }));
      setBusy(false);
    }
    return { correct, masteryAfter };
  }, [state.lesson, state.mastery]);

  const resetDemo = useCallback(() => {
    window.localStorage.removeItem("edurecall-demo-v1");
    window.localStorage.removeItem("edurecall-access-token");
    window.localStorage.removeItem("edurecall-refresh-token");
    setState(initialState);
  }, []);

  const value = useMemo<DemoContextValue>(() => ({
    ...state,
    busy,
    setRole,
    submitRangeMistake,
    submitLearningAttempt,
    generateLesson,
    updateLesson,
    approveLesson: () => transition("approve"),
    publishLesson: () => transition("publish"),
    completeQuiz,
    resetDemo
  }), [state, busy, setRole, submitRangeMistake, submitLearningAttempt, generateLesson, updateLesson, transition, completeQuiz, resetDemo]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used inside DemoProvider");
  return value;
}
