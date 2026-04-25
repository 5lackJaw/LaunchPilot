"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/server/services/auth-service";
import { BriefEditError, BriefService } from "@/server/services/brief-service";
import { ProductReadError } from "@/server/services/product-service";

export async function saveMarketingBriefAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  let redirectTo = "/marketing-brief";

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

    revalidatePath("/marketing-brief");
    revalidatePath("/seo");
    redirectTo = "/marketing-brief?saved=1";
  } catch (error) {
    const message = toBriefEditMessage(error);
    redirectTo = `/marketing-brief?saveError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}

function toBriefEditMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the edited fields and try again.";
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

  return "Marketing Brief could not be saved.";
}

function splitLines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
