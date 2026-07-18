export type Role = "STUDENT" | "TEACHER" | "ADMIN";
export type ContentStatus = "GENERATING" | "DRAFT" | "IN_REVIEW" | "REVISION_REQUIRED" | "APPROVED" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
export type RecommendationAction = "FLASH_REVIEW" | "MICRO_LESSON" | "PRACTICE_SET" | "PREREQUISITE_REVIEW" | "CONTINUE_PATH" | "CHECKPOINT" | "GAME_PRACTICE" | "TEACHER_SUPPORT";
export type SlideType = "CONCEPT" | "CODE_STEP" | "EXAMPLE" | "MISCONCEPTION" | "VISUAL" | "QUIZ" | "SUMMARY";

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

/* FEATURE-016 — three-part lesson structure (Theory → Practice → Final assessment). */
export type LessonSectionType = "THEORY" | "PRACTICE" | "FINAL_ASSESSMENT";

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
  reviewStatus: "PENDING_REVIEW" | "APPROVED";
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
  resources?: TheoryResource[];
  activities?: PracticeActivity[];
  assessment?: FinalAssessment;
  reviewStatus: "PENDING_REVIEW" | "APPROVED";
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
  /** FEATURE-016: three ordered sections; optional for legacy lessons. */
  sections?: LessonSection[];
  status: ContentStatus;
  provider: "LOCAL_TEMPLATE" | "EXTERNAL_LLM" | "MOCK_DEVELOPMENT";
  reuseCount: number;
  version: number;
  generationMs?: number;
  teacherEditingSeconds?: number;
  workflowStartedAt?: string;
}
