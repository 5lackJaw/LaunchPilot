"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/server/services/auth-service";
import { BriefEditError, BriefService } from "@/server/services/brief-service";
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

export async function saveBriefEditAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");

  try {
    const supabase = await createSupabaseServerClient();
    await new BriefService(supabase).createEditedVersion({
      productId,
      tagline: formData.get("tagline"),
      valueProps: splitLines(formData.get("valueProps")),
      personas: splitLines(formData.get("personas")),
      competitors: splitLines(formData.get("competitors")),
      toneVoice: formData.get("toneVoice"),
      toneAvoid: splitLines(formData.get("toneAvoid")),
    });
  } catch (error) {
    const message = toBriefEditMessage(error);
    redirect(`/onboarding/brief?productId=${encodeURIComponent(productId)}&editError=${encodeURIComponent(message)}`);
  }

  redirect(`/onboarding/brief?productId=${encodeURIComponent(productId)}&edited=1`);
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

function toBriefEditMessage(error: unknown) {
  if (error instanceof ZodError) {
    return "Check the edited fields and try again.";
  }

  if (error instanceof AuthRequiredError) {
    return error.message;
  }

  if (error instanceof ProductReadError || error instanceof BriefEditError) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return "Supabase is not configured yet.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Brief edit could not be saved.";
}

function splitLines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
