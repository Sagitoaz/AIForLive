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
  avatar?: string | null;
  classRoles?: Array<"OWNER" | "INSTRUCTOR" | "REVIEWER">;
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

export type AttemptGradingStrategy = "LEGACY_EXACT" | "IDEA_RUBRIC" | "CODE_ORDER";
export type AttemptGradingMode =
  | "SERVER_ANSWER_KEY"
  | "EXTERNAL_LLM"
  | "DETERMINISTIC_RUBRIC_FALLBACK"
  | "DETERMINISTIC_CODE_ORDER";

export interface AttemptCriterionResult {
  id: string;
  coverage: number;
  evidence: string[];
  feedback: string;
}

export interface AttemptGradingDetails {
  strategy: AttemptGradingStrategy;
  mode: AttemptGradingMode;
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
  grading?: AttemptGradingDetails;
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
  teacherEditingSeconds: number;
  estimatedCostUsd: number;
  requestedBy: { id: string; displayName: string };
  generationTrace?: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    promptHash: string;
  };
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

/**
 * Student-facing projection of published content. Authoring traces, review
 * history and answer keys deliberately remain teacher-only.
 */
export interface StudentPublishedLearningContent {
  id: string;
  title: string;
  domainCode: string;
  conceptCode: string;
  level: string;
  objectives: string[];
  sourceReferences: string[];
  slides: ContentSlide[];
  quiz: { question: string; options: string[] };
  practiceQuestions: Array<{ question: string; options: string[] }>;
  status: "PUBLISHED";
  version: number;
  updatedAt: string;
  draftKind?: "FULL_LESSON" | "REMEDIATION";
  gradeBand?: string;
  totalDurationMinutes?: number;
  sections?: GeneratedLearningContent["sections"];
}
