import { z } from "zod";

export const slideSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  type: z.enum(["CONCEPT", "CODE_STEP", "EXAMPLE", "MISCONCEPTION", "VISUAL", "QUIZ", "SUMMARY"]),
  title: z.string().min(3).max(100),
  body: z.string().min(10).max(1200),
  code: z.string().max(1000).optional(),
  narration: z.string().min(10).max(1600),
  animationTemplate: z.enum(["NUMBER_SEQUENCE", "VARIABLE_CHANGE", "CODE_HIGHLIGHT", "FLOW_BRANCH", "LOOP_TIMELINE", "LIST_INDEX", "FUNCTION_FLOW", "BUG_REVEAL"]),
  animationData: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())]))
});

export const microLessonSchema = z.object({
  title: z.string().min(3).max(120),
  domainCode: z.string().min(2),
  conceptCode: z.string().min(2),
  misconceptionCode: z.string().min(2),
  level: z.string().min(2),
  objectives: z.array(z.string().min(3)).min(1).max(4),
  sourceReferences: z.array(z.string().min(1)).min(1),
  slides: z.array(slideSchema).min(3).max(5),
  quiz: z.object({
    question: z.string().min(5),
    options: z.array(z.string().min(1)).min(2).max(5),
    correctIndex: z.number().int().nonnegative(),
    explanation: z.string().min(5)
  })
}).superRefine((lesson, context) => {
  if (lesson.quiz.correctIndex >= lesson.quiz.options.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["quiz", "correctIndex"], message: "Correct answer must reference an option" });
  }
  const raw = JSON.stringify(lesson).toLowerCase();
  if (raw.includes("<script") || raw.includes("javascript:") || raw.includes("http://") || raw.includes("https://")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Unsafe HTML or remote URL is not allowed" });
  }
});
