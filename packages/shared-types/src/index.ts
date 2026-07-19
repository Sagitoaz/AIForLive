export type Role = "STUDENT" | "TEACHER" | "ADMIN";
export type ContentStatus = "GENERATING" | "DRAFT" | "IN_REVIEW" | "REVISION_REQUIRED" | "APPROVED" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
export type RecommendationAction = "FLASH_REVIEW" | "MICRO_LESSON" | "PRACTICE_SET" | "PREREQUISITE_REVIEW" | "CONTINUE_PATH" | "CHECKPOINT" | "GAME_PRACTICE" | "TEACHER_SUPPORT";
export type SlideType = "CONCEPT" | "CODE_STEP" | "EXAMPLE" | "MISCONCEPTION" | "VISUAL" | "QUIZ" | "SUMMARY";
export type LessonPhase = "THEORY" | "PRACTICE" | "CHECKPOINT";
export type LearningActivityType = "LECTURE" | "VIDEO" | "ANIMATION" | "DOCUMENT" | "CODE" | "MULTIPLE_CHOICE" | "CODE_ORDER" | "DEBUG" | "PROJECT";

export interface ConceptState {
  conceptCode: string;
  mastery: number;
  stability: number;
  retrievability: number;
  forgettingRisk: number;
}

export interface RecommendationEvidence {
  attemptIds: string[];
  modelVersion: string;
  ruleId: string | null;
  signals: Record<string, number | string | boolean>;
}

export interface LearningRecommendation {
  id: string;
  action: RecommendationAction;
  priorityScore: number;
  reasons: string[];
  evidence: RecommendationEvidence;
  conceptCode: string;
  status: "ACTIVE" | "COMPLETED" | "DISMISSED";
  target?: RecommendationTarget;
}

export interface RecommendationTarget {
  type: "LESSON_PHASE" | "ACTIVITY" | "MICRO_LESSON";
  id: string;
  title: string;
  phase: LessonPhase;
  estimatedMinutes: number;
  difficulty?: number;
}

export interface LessonDraftSection {
  phase: LessonPhase;
  title: string;
  durationMinutes: number;
  summary: string;
  activityTypes: LearningActivityType[];
}

export interface MicroLessonSlide {
  id: string;
  order: number;
  type: SlideType;
  title: string;
  body: string;
  code?: string;
  narration: string;
  animationTemplate: string;
  animationData: Record<string, string | number | string[]>;
}

export interface GeneratedQuiz {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface MicroLesson {
  id: string;
  title: string;
  domainCode: string;
  conceptCode: string;
  misconceptionCode: string;
  level: string;
  objectives: string[];
  sourceReferences: string[];
  slides: MicroLessonSlide[];
  quiz: GeneratedQuiz;
  practiceQuestions?: GeneratedQuiz[];
  status: ContentStatus;
  provider: "LOCAL_TEMPLATE" | "EXTERNAL_LLM";
  reuseCount: number;
  version: number;
  generationMs?: number;
  teacherEditingSeconds?: number;
  requestedBy?: { id: string; displayName: string };
  generationTrace?: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    promptHash: string;
  };
  workflowStartedAt?: string;
  draftKind?: "FULL_LESSON" | "REMEDIATION";
  gradeBand?: string;
  totalDurationMinutes?: number;
  sections?: LessonDraftSection[];
}
