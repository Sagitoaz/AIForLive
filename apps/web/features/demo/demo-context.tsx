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
}

interface DemoContextValue extends StoredDemoState {
  busy: boolean;
  setRole: (role: "student" | "teacher") => void;
  submitRangeMistake: () => Promise<void>;
  generateLesson: () => Promise<void>;
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
  lastMessage: "Demo sẵn sàng"
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

const localLesson = (timing: ContentWorkflowTiming): MicroLesson => ({
  id: `lesson-${crypto.randomUUID()}`,
  title: "Dừng đúng lúc với range()",
  domainCode: "python-foundations",
  conceptCode: "PYTHON_RANGE",
  misconceptionCode: "RANGE_STOP_INCLUDED",
  level: "Mới bắt đầu",
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
      setState((current) => ({ ...current, attemptId: result.id, analysis: result.analysis, mastery: result.analysis.mastery_after, lastMessage: result.analysis.mode === "AI_SERVICE" ? "Python AI service đã phân tích attempt" : "API đang dùng personalization fallback mode" }));
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
          evidence: { attemptIds: [key], modelVersion: "fallback-v1", ruleId: "range-stop-rule-v1" }
        },
        explanations: ["Knowledge tracing đo mức hiểu", "Forgetting model đo nguy cơ quên", "Recommendation chọn hoạt động từ signal thật"]
      };
      setState((current) => ({ ...current, attemptId: key, analysis, mastery: analysis.mastery_after, lastMessage: "Personalization fallback mode — attempt vẫn được lưu trong demo" }));
    } finally {
      setBusy(false);
    }
  }, []);

  const generateLesson = useCallback(async () => {
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
          learningObjective: "Biết rằng stop không thuộc dãy",
          durationMinutes: 5,
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
        lesson: localLesson({ generationMs, teacherEditingSeconds: 0, workflowStartedAt }),
        lastMessage: "FPT AI không khả dụng; trình duyệt chuyển sang bản nháp local và ghi rõ fallback"
      }));
    } finally {
      setBusy(false);
    }
  }, []);

  const updateLesson = useCallback(async (lesson: MicroLesson) => {
    setBusy(true);
    try {
      if (state.lesson?.id) {
        await apiRequest(`/teacher/generated-content/${state.lesson.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: lesson.title, slides: lesson.slides.map(({ id, title, body, narration }) => ({ id, title, body, narration })), quiz: lesson.quiz })
        });
      }
    } catch {
      // Browser demo keeps the teacher edit locally when the API is offline.
    } finally {
      setState((current) => ({
        ...current,
        lesson: withTeacherElapsed({ ...lesson, version: lesson.version + 1 }),
        lastMessage: "Đã lưu chỉnh sửa của giáo viên và validate lại quiz"
      }));
      setBusy(false);
    }
  }, [state.lesson?.id]);

  const transition = useCallback(async (action: "approve" | "publish") => {
    if (!state.lesson) return;
    setBusy(true);
    try {
      await apiRequest(`/teacher/generated-content/${state.lesson.id}/${action}`, { method: "POST", body: JSON.stringify({ comment: action === "approve" ? "Đã kiểm tra tính chính xác" : "Sẵn sàng cho học viên" }) });
    } catch {
      // The local state follows the same guarded transition in offline demo mode.
    } finally {
      setState((current) => current.lesson ? {
        ...current,
        lesson: withTeacherElapsed({
          ...current.lesson,
          status: action === "approve" ? "APPROVED" : "PUBLISHED",
          version: current.lesson.version + 1
        }),
        lastMessage: action === "approve" ? "Nội dung đã APPROVED" : "Nội dung đã PUBLISHED cho học viên"
      } : current);
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
    setState(initialState);
  }, []);

  const value = useMemo<DemoContextValue>(() => ({
    ...state,
    busy,
    setRole,
    submitRangeMistake,
    generateLesson,
    updateLesson,
    approveLesson: () => transition("approve"),
    publishLesson: () => transition("publish"),
    completeQuiz,
    resetDemo
  }), [state, busy, setRole, submitRangeMistake, generateLesson, updateLesson, transition, completeQuiz, resetDemo]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used inside DemoProvider");
  return value;
}
