"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/server/services/auth-service";
import { BriefService } from "@/server/services/brief-service";
import { ProductReadError } from "@/server/services/product-service";

export async function requestBriefGenerationAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");

  try {
    const supabase = await createSupabaseServerClient();
    await new BriefService(supabase).requestGeneration({ productId });
  } catch (error) {
    const message = toBriefRequestMessage(error);
    redirect(`/onboarding/interview?productId=${encodeURIComponent(productId)}&briefError=${encodeURIComponent(message)}`);
  }

  redirect(`/onboarding/brief?productId=${encodeURIComponent(productId)}&requested=1`);
}

function toBriefRequestMessage(error: unknown) {
  if (error instanceof ZodError) {
    return "Missing or invalid product ID.";
  }

  if (error instanceof AuthRequiredError) {
    return error.message;
  }

  if (error instanceof ProductReadError) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return "Supabase is not configured yet.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Brief generation could not be requested.";
}
