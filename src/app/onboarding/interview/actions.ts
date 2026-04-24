"use server";

import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/server/services/auth-service";
import { InterviewAnswerSaveError, InterviewService } from "@/server/services/interview-service";

export type InterviewSaveState = {
  status: "idle" | "success" | "error";
  message?: string;
  savedQuestionId?: string;
};

export async function saveInterviewAnswerAction(
  _previousState: InterviewSaveState,
  formData: FormData,
): Promise<InterviewSaveState> {
  try {
    const supabase = await createSupabaseServerClient();
    const answer = await new InterviewService(supabase).saveAnswer({
      productId: formData.get("productId"),
      questionId: formData.get("questionId"),
      answer: formData.get("answer"),
    });

    return {
      status: "success",
      message: "Answer saved.",
      savedQuestionId: answer.questionId,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        status: "error",
        message: "Check the answer and try again.",
      };
    }

    if (error instanceof AuthRequiredError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    if (error instanceof InterviewAnswerSaveError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        status: "error",
        message: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local before saving answers.",
      };
    }

    throw error;
  }
}
