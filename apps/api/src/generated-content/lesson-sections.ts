import { randomUUID } from "node:crypto";
import type {
  AssessmentQuestion,
  DemoContent,
  DemoSlide,
  LessonSection,
  PracticeActivity,
  ResourceReviewStatus,
  TheoryResource
} from "../common/types";
import { SECTION_ORDER } from "../common/types";
import type { ProviderOutput } from "../ai-generation/providers/content-provider";

const DEFAULT_PASSING_SCORE = 0.7;

/** Convert a linear slide deck into ordered THEORY resources. */
function slidesToResources(slides: DemoSlide[], reviewStatus: ResourceReviewStatus): TheoryResource[] {
  return slides.map((slide, index) => ({
    id: `resource-slide-${slide.id}`,
    type: slide.type === "SUMMARY" ? "SUMMARY" : slide.type === "EXAMPLE" ? "EXAMPLE" : "SLIDE_DECK",
    title: slide.title,
    content: slide.body,
    description: slide.narration,
    autoplay: false,
    required: slide.type !== "SUMMARY",
    order: index + 1,
    reviewStatus
  }));
}

/**
 * FEATURE-016 — build the three mandatory sections from a fresh provider output.
 * AI-authored content is marked PENDING_REVIEW so it can never reach a student
 * before a human approves the lesson.
 */
export function buildSectionsFromOutput(output: ProviderOutput): LessonSection[] {
  const reviewStatus: ResourceReviewStatus = "PENDING_REVIEW";

  const theoryResources: TheoryResource[] = [
    ...slidesToResources(output.slides, reviewStatus),
    ...output.theory.videos.map((video, index) => ({
      id: `resource-video-${index + 1}`,
      type: "VIDEO" as const,
      title: video.title,
      description: video.description,
      url: video.url,
      durationSeconds: video.durationSeconds,
      thumbnailUrl: video.thumbnailUrl,
      autoplay: false,
      required: index === 0,
      order: output.slides.length + index + 1,
      reviewStatus
    })),
    ...output.theory.documents.map((document, index) => ({
      id: `resource-document-${index + 1}`,
      type: "DOCUMENT" as const,
      title: document.title,
      description: document.description,
      content: document.content,
      url: document.url,
      autoplay: false,
      required: false,
      order: output.slides.length + output.theory.videos.length + index + 1,
      reviewStatus
    })),
    {
      id: "resource-summary",
      type: "SUMMARY",
      title: "Tóm tắt phần lý thuyết",
      content: output.theory.summary,
      autoplay: false,
      required: false,
      order: output.slides.length + output.theory.videos.length + output.theory.documents.length + 1,
      reviewStatus
    }
  ];

  const theory: LessonSection = {
    id: `section-theory-${randomUUID()}`,
    type: "THEORY",
    title: "Lý thuyết",
    description: "Kiến thức nền tảng: bài giảng, ví dụ, video và tài liệu đọc thêm.",
    order: SECTION_ORDER.THEORY,
    isRequired: true,
    completionRule: { requireAllRequiredResources: true, minVideoWatchRatio: 0.8 },
    resources: theoryResources,
    reviewStatus
  };

  const practice: LessonSection = {
    id: `section-practice-${randomUUID()}`,
    type: "PRACTICE",
    title: "Thực hành",
    description: "Áp dụng kiến thức qua ví dụ code, bài tập, đoán output và trắc nghiệm.",
    order: SECTION_ORDER.PRACTICE,
    isRequired: true,
    completionRule: { minActivitiesCompleted: Math.max(1, Math.ceil(output.practice.length / 2)) },
    activities: output.practice,
    reviewStatus
  };

  const finalAssessment: LessonSection = {
    id: `section-final-${randomUUID()}`,
    type: "FINAL_ASSESSMENT",
    title: "Kiểm tra cuối bài",
    description: "Bài kiểm tra tổng hợp bắt buộc để hoàn thành bài học.",
    order: SECTION_ORDER.FINAL_ASSESSMENT,
    isRequired: true,
    completionRule: { minScore: output.finalAssessment.passingScore || DEFAULT_PASSING_SCORE },
    assessment: {
      id: `assessment-${randomUUID()}`,
      title: "Kiểm tra cuối bài",
      passingScore: output.finalAssessment.passingScore || DEFAULT_PASSING_SCORE,
      maxAttempts: 3,
      questions: output.finalAssessment.questions,
      skillCoverage: output.finalAssessment.skillCoverage
    },
    reviewStatus
  };

  return [theory, practice, finalAssessment];
}

/**
 * FEATURE-016 — backward-compatible migration. Existing lessons only have a
 * linear slide deck and a single quiz. This derives a safe three-part structure
 * without losing any slide or quiz, and without inventing learning results:
 * the FINAL_ASSESSMENT is seeded from the legacy quiz and flagged for teacher
 * completion when no real assessment exists.
 */
export function buildSectionsFromLegacy(content: {
  slides: DemoSlide[];
  quiz: DemoContent["quiz"];
  conceptCode: string;
  status?: DemoContent["status"];
}): LessonSection[] {
  const reviewStatus: ResourceReviewStatus =
    content.status === "PUBLISHED" || content.status === "APPROVED" ? "APPROVED" : "PENDING_REVIEW";

  const theory: LessonSection = {
    id: `section-theory-${randomUUID()}`,
    type: "THEORY",
    title: "Lý thuyết",
    description: "Được chuyển đổi từ slide bài học hiện có.",
    order: SECTION_ORDER.THEORY,
    isRequired: true,
    completionRule: { requireAllRequiredResources: true },
    resources: slidesToResources(content.slides, reviewStatus),
    reviewStatus
  };

  const legacyPractice: PracticeActivity | null = content.quiz
    ? {
        id: `activity-legacy-quiz-${randomUUID()}`,
        type: "MULTIPLE_CHOICE",
        title: "Câu hỏi luyện tập",
        instructions: content.quiz.question,
        conceptCode: content.conceptCode,
        difficulty: 0.4,
        maxScore: 10,
        options: content.quiz.options,
        correctIndex: content.quiz.correctIndex,
        hints: [],
        explanation: content.quiz.explanation,
        order: 1
      }
    : null;

  const practice: LessonSection = {
    id: `section-practice-${randomUUID()}`,
    type: "PRACTICE",
    title: "Thực hành",
    description: "Quiz hiện có được chuyển vào phần thực hành.",
    order: SECTION_ORDER.PRACTICE,
    isRequired: true,
    completionRule: { minActivitiesCompleted: legacyPractice ? 1 : 0 },
    activities: legacyPractice ? [legacyPractice] : [],
    reviewStatus
  };

  const finalQuestions: AssessmentQuestion[] = content.quiz
    ? [
        {
          id: `question-legacy-${randomUUID()}`,
          type: "MULTIPLE_CHOICE",
          conceptCode: content.conceptCode,
          prompt: content.quiz.question,
          options: content.quiz.options,
          correctIndex: content.quiz.correctIndex,
          points: 10,
          explanation: content.quiz.explanation
        }
      ]
    : [];

  const finalAssessment: LessonSection = {
    id: `section-final-${randomUUID()}`,
    type: "FINAL_ASSESSMENT",
    title: "Kiểm tra cuối bài",
    description: content.quiz
      ? "Bản kiểm tra tạm sinh từ quiz cũ — giảng viên cần bổ sung thêm câu hỏi."
      : "Chưa có bài kiểm tra cuối bài — cần giảng viên bổ sung.",
    order: SECTION_ORDER.FINAL_ASSESSMENT,
    isRequired: true,
    completionRule: { minScore: DEFAULT_PASSING_SCORE },
    assessment: {
      id: `assessment-${randomUUID()}`,
      title: "Kiểm tra cuối bài",
      passingScore: DEFAULT_PASSING_SCORE,
      maxAttempts: 3,
      questions: finalQuestions,
      skillCoverage: [content.conceptCode]
    },
    // Migrated final assessments always need a human to confirm coverage.
    reviewStatus: "PENDING_REVIEW"
  };

  return [theory, practice, finalAssessment];
}

/** Grade a submitted final assessment and return per-skill results. */
export function gradeFinalAssessment(
  assessment: FinalAssessmentInput,
  answers: Array<{ questionId: string; selectedIndex?: number; answer?: string }>
): AssessmentGrade {
  const answerByQuestion = new Map(answers.map((entry) => [entry.questionId, entry]));
  let earned = 0;
  let total = 0;
  const skillTotals = new Map<string, { earned: number; total: number }>();
  const questionResults = assessment.questions.map((question) => {
    total += question.points;
    const bucket = skillTotals.get(question.conceptCode) ?? { earned: 0, total: 0 };
    bucket.total += question.points;
    const submitted = answerByQuestion.get(question.id);
    let correct = false;
    if (question.options && typeof question.correctIndex === "number") {
      correct = submitted?.selectedIndex === question.correctIndex;
    } else if (question.expectedAnswer) {
      correct = normalise(submitted?.answer) === normalise(question.expectedAnswer);
    }
    if (correct) {
      earned += question.points;
      bucket.earned += question.points;
    }
    skillTotals.set(question.conceptCode, bucket);
    return { questionId: question.id, conceptCode: question.conceptCode, correct, points: question.points, explanation: question.explanation };
  });

  const scoreRatio = total > 0 ? earned / total : 0;
  const skillResults = [...skillTotals.entries()].map(([conceptCode, value]) => ({
    conceptCode,
    scoreRatio: value.total > 0 ? Number((value.earned / value.total).toFixed(4)) : 0,
    weak: value.total > 0 ? value.earned / value.total < assessment.passingScore : false
  }));

  return {
    earned,
    total,
    scoreRatio: Number(scoreRatio.toFixed(4)),
    passed: scoreRatio >= assessment.passingScore,
    passingScore: assessment.passingScore,
    questionResults,
    skillResults
  };
}

function normalise(value?: string): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export interface FinalAssessmentInput {
  passingScore: number;
  questions: AssessmentQuestion[];
}

export interface AssessmentGrade {
  earned: number;
  total: number;
  scoreRatio: number;
  passed: boolean;
  passingScore: number;
  questionResults: Array<{ questionId: string; conceptCode: string; correct: boolean; points: number; explanation: string }>;
  skillResults: Array<{ conceptCode: string; scoreRatio: number; weak: boolean }>;
}
