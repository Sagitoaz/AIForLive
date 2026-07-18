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
  status: ContentStatus;
  provider: "LOCAL_TEMPLATE" | "EXTERNAL_LLM";
  reuseCount: number;
  version: number;
  generationMs: number;
  estimatedCostUsd: number;
  reviewHistory: Array<{ action: string; from: ContentStatus; to: ContentStatus; at: string; comment?: string }>;
  updatedAt: string;
}
