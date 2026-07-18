export type DemoRole = "STUDENT" | "TEACHER";
export type ContentStatus =
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
  role: DemoRole;
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
  };
  explanations: string[];
  mode: "AI_SERVICE" | "DETERMINISTIC_FALLBACK";
}

export interface DemoAttempt {
  id: string;
  idempotencyKey: string;
  studentId: string;
  conceptCode: string;
  isCorrect: boolean;
  usedHint: boolean;
  status: "PENDING_ANALYSIS" | "ANALYZED" | "FALLBACK_ANALYZED";
  createdAt: string;
  analysis: AnalysisResult | null;
}

export interface DemoSlide {
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

export interface DemoContent {
  id: string;
  title: string;
  domainCode: string;
  conceptCode: string;
  misconceptionCode: string;
  level: string;
  objectives: string[];
  sourceReferences: string[];
  slides: DemoSlide[];
  quiz: { question: string; options: string[]; correctIndex: number; explanation: string };
  /**
   * FEATURE-016: every lesson is organised into exactly three ordered sections
   * (THEORY → PRACTICE → FINAL_ASSESSMENT). Kept alongside `slides`/`quiz` so
   * legacy consumers keep working while new consumers read `sections`.
   */
  sections: LessonSection[];
  status: ContentStatus;
  provider: "LOCAL_TEMPLATE" | "EXTERNAL_LLM";
  reuseCount: number;
  version: number;
  generationMs: number;
  estimatedCostUsd: number;
  reviewHistory: Array<{ action: string; from: ContentStatus; to: ContentStatus; at: string; comment?: string }>;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* FEATURE-016 — Three-part lesson structure                          */
/* ------------------------------------------------------------------ */

export type LessonSectionType = "THEORY" | "PRACTICE" | "FINAL_ASSESSMENT";

export type SectionStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "LOCKED";

export type ResourceReviewStatus = "PENDING_REVIEW" | "APPROVED";

export const SECTION_ORDER: Record<LessonSectionType, number> = {
  THEORY: 1,
  PRACTICE: 2,
  FINAL_ASSESSMENT: 3
};

export interface CompletionRule {
  /** THEORY: all resources flagged `required` must be opened/viewed. */
  requireAllRequiredResources?: boolean;
  /** THEORY: minimum ratio [0..1] of a required video that must be watched. */
  minVideoWatchRatio?: number;
  /** PRACTICE: minimum number of activities that must be completed. */
  minActivitiesCompleted?: number;
  /** FINAL_ASSESSMENT: minimum normalised score [0..1] to pass. */
  minScore?: number;
}

export interface TheoryResource {
  id: string;
  type: "LECTURE" | "SLIDE_DECK" | "VIDEO" | "DOCUMENT" | "READING" | "EXAMPLE" | "SUMMARY";
  title: string;
  description?: string;
  content?: string;
  url?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  autoplay: boolean;
  required: boolean;
  order: number;
  /** AI-authored resources stay PENDING_REVIEW until a human approves them. */
  reviewStatus: ResourceReviewStatus;
}

export interface PracticeActivity {
  id: string;
  type:
    | "CODE_EXAMPLE"
    | "CODE_EXERCISE"
    | "OUTPUT_PREDICTION"
    | "DEBUGGING_EXERCISE"
    | "MULTIPLE_CHOICE"
    | "FILL_IN_THE_BLANK"
    | "PRACTICE_QUIZ";
  title: string;
  instructions: string;
  conceptCode: string;
  difficulty: number;
  maxScore: number;
  prompt?: string;
  starterCode?: string;
  options?: string[];
  correctIndex?: number;
  expectedOutput?: string;
  hints: string[];
  solution?: string;
  explanation?: string;
  order: number;
}

export interface AssessmentQuestion {
  id: string;
  type: "MULTIPLE_CHOICE" | "OUTPUT_PREDICTION" | "DEBUGGING" | "SCENARIO" | "SHORT_CODE";
  conceptCode: string;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  expectedAnswer?: string;
  points: number;
  explanation: string;
}

export interface FinalAssessment {
  id: string;
  title: string;
  /** Normalised pass threshold [0..1]; defaults to 0.7 but is configurable per lesson. */
  passingScore: number;
  timeLimitMinutes?: number;
  maxAttempts?: number;
  questions: AssessmentQuestion[];
  skillCoverage: string[];
}

export interface LessonSection {
  id: string;
  type: LessonSectionType;
  title: string;
  description?: string;
  order: number;
  isRequired: boolean;
  completionRule?: CompletionRule;
  resources?: TheoryResource[];
  activities?: PracticeActivity[];
  assessment?: FinalAssessment;
  reviewStatus: ResourceReviewStatus;
}

export interface SectionProgress {
  studentId: string;
  contentId: string;
  sectionType: LessonSectionType;
  status: SectionStatus;
  progressPercent: number;
  score?: number;
  attempts: number;
  completedAt?: string;
}
