import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthService } from "@/server/services/auth-service";
import { interviewAnswerSchema, saveInterviewAnswerSchema } from "@/server/schemas/interview";
import { productIdSchema } from "@/server/schemas/product";

export class InterviewService {
  constructor(private readonly supabase: SupabaseClient) {}

  async listAnswers(input: unknown) {
    const { productId } = productIdSchema.parse(input);
    await new AuthService(this.supabase).requireUser();

    const { data, error } = await this.supabase
      .from("interview_answers")
      .select("id,product_id,question_id,answer,created_at,updated_at")
      .eq("product_id", productId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new InterviewAnswerReadError(error.message);
    }

    return data.map(mapInterviewAnswer);
  }

  async saveAnswer(input: unknown) {
    const parsed = saveInterviewAnswerSchema.parse(input);
    await new AuthService(this.supabase).requireUser();

    const { data, error } = await this.supabase
      .from("interview_answers")
      .upsert(
        {
          product_id: parsed.productId,
          question_id: parsed.questionId,
          answer: parsed.answer,
        },
        { onConflict: "product_id,question_id" },
      )
      .select("id,product_id,question_id,answer,created_at,updated_at")
      .single();

    if (error) {
      throw new InterviewAnswerSaveError(error.message);
    }

    return mapInterviewAnswer(data);
  }
}

export class InterviewAnswerReadError extends Error {
  constructor(message: string) {
    super(`Interview answers could not be loaded: ${message}`);
    this.name = "InterviewAnswerReadError";
  }
}

export class InterviewAnswerSaveError extends Error {
  constructor(message: string) {
    super(`Interview answer could not be saved: ${message}`);
    this.name = "InterviewAnswerSaveError";
  }
}

function mapInterviewAnswer(data: {
  id: string;
  product_id: string;
  question_id: string;
  answer: string;
  created_at: string;
  updated_at: string;
}) {
  return interviewAnswerSchema.parse({
    id: data.id,
    productId: data.product_id,
    questionId: data.question_id,
    answer: data.answer,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}
