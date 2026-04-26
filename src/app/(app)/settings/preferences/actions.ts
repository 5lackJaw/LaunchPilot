"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/server/services/auth-service";
import { PreferencesService, PreferencesUpdateError } from "@/server/services/preferences-service";

export async function updateAutomationPreferenceAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const channel = String(formData.get("channel") ?? "");

  try {
    const supabase = await createSupabaseServerClient();
    await new PreferencesService(supabase).updateAutomationPreference({
      productId,
      channel,
      trustLevel: formData.get("trustLevel"),
      dailyAutoActionLimit: formData.get("dailyAutoActionLimit"),
      reviewWindowHours: formData.get("reviewWindowHours"),
    });
  } catch (error) {
    const message = toPreferenceErrorMessage(error);
    redirect(`/settings/preferences?preferenceError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings/preferences");
  redirect(`/settings/preferences?updated=${encodeURIComponent(channel)}`);
}

function toPreferenceErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return "Check the trust level settings and try again.";
  }

  if (error instanceof AuthRequiredError) {
    return error.message;
  }

  if (error instanceof PreferencesUpdateError) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return "Supabase is not configured yet.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Automation preference could not be saved.";
}
