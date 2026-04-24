import { z } from "zod";
import { interviewQuestions } from "@/app/onboarding/interview/interview-questions";

const interviewQuestionIds = interviewQuestions.map((question) => question.id) as [string, ...string[]];

export const interviewQuestionIdSchema = z.enum(interviewQuestionIds);

export const saveInterviewAnswerSchema = z.object({
  productId: z.string().uuid(),
  questionId: interviewQuestionIdSchema,
  answer: z.string().trim().max(5000, "Use 5000 characters or fewer."),
});

export const interviewAnswerSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  questionId: interviewQuestionIdSchema,
  answer: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type InterviewAnswer = z.infer<typeof interviewAnswerSchema>;
export type SaveInterviewAnswerInput = z.infer<typeof saveInterviewAnswerSchema>;
