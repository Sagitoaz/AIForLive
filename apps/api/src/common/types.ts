export type AppRole = "STUDENT" | "TEACHER" | "ADMIN";
export type ContentStatus =
  | "GENERATING"
  | "DRAFT"
  | "IN_REVIEW"
  | "REVISION_REQUIRED"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "ARCHIVED";

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
}

export interface AnalysisResult {
  event_id: string;
  model_version: string;
  mastery_before: number;
  mastery_after: number;
  observation_confidence: number;
  retrievability: number;
  forgetting_risk: number;
  recommended_interval_days: number;
  next_attempt_probability: number;
  diagnosis: {
    status: "MATCHED" | "UNKNOWN" | "NEED_MORE_EVIDENCE";
    concept_code: string;
    misconception_code: string | null;
    confidence: number;
    source: "DOMAIN_RULE" | "FALLBACK";
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
  mode: "AI_SERVICE" | "DETERMINISTIC_FALLBACK";
}

export interface LearningAttempt {
  id: string;
  idempotencyKey: string;
  studentId: string;
  conceptCode: string;
  activityId?: string;
  lessonPhase?: "THEORY" | "PRACTICE" | "CHECKPOINT";
  isCorrect: boolean;
  usedHint: boolean;
  status: "PENDING_ANALYSIS" | "ANALYZED" | "FALLBACK_ANALYZED" | "FAILED";
  createdAt: string;
  analysis: AnalysisResult | null;
}

export interface ContentSlide {
  id: string;
  order: number;
  type: "CONCEPT" | "CODE_STEP" | "EXAMPLE" | "MISCONCEPTION" | "VISUAL" | "QUIZ" | "SUMMARY";
  title: string;
  body: string;
  code?: string;
  narration: string;
  animationTemplate: string;
  animationData: Record<string, string | number | string[]>;
}

export interface GeneratedLearningContent {
  id: string;
  title: string;
  domainCode: string;
  conceptCode: string;
  misconceptionCode: string;
  level: string;
  objectives: string[];
  sourceReferences: string[];
  slides: ContentSlide[];
  quiz: { question: string; options: string[]; correctIndex: number; explanation: string };
  practiceQuestions?: Array<{ question: string; options: string[]; correctIndex: number; explanation: string }>;
  status: ContentStatus;
  provider: "LOCAL_TEMPLATE" | "EXTERNAL_LLM";
  reuseCount: number;
  version: number;
  generationMs: number;
  estimatedCostUsd: number;
  reviewHistory: Array<{ action: string; from: ContentStatus; to: ContentStatus; at: string; comment?: string }>;
  updatedAt: string;
  draftKind?: "FULL_LESSON" | "REMEDIATION";
  gradeBand?: string;
  totalDurationMinutes?: number;
  sections?: Array<{
    phase: "THEORY" | "PRACTICE" | "CHECKPOINT";
    title: string;
    durationMinutes: number;
    summary: string;
    activityTypes: Array<"LECTURE" | "VIDEO" | "ANIMATION" | "DOCUMENT" | "CODE" | "MULTIPLE_CHOICE" | "CODE_ORDER" | "DEBUG" | "PROJECT">;
  }>;
}
