"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/server/services/auth-service";
import { AuthService } from "@/server/services/auth-service";
import { isInternalAdmin } from "@/server/services/admin-service";
import { PreferencesService, PreferencesUpdateError } from "@/server/services/preferences-service";

const adminModes = new Set(["free", "launch", "growth", "god"]);

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

export async function updateAdminAccountModeAction(formData: FormData) {
  const mode = String(formData.get("adminAccountMode") ?? "");

  try {
    if (!adminModes.has(mode)) {
      throw new PreferencesUpdateError("Choose a valid account mode.");
    }

    const supabase = await createSupabaseServerClient();
    const user = await new AuthService(supabase).requireUser();
    if (!isInternalAdmin(user)) {
      throw new PreferencesUpdateError("Admin account mode is only available to internal admins.");
    }

    const { error } = await supabase
      .from("users")
      .update({ admin_account_mode: mode })
      .eq("id", user.id);

    if (error) {
      throw new PreferencesUpdateError(error.message);
    }
  } catch (error) {
    const message = toPreferenceErrorMessage(error);
    redirect(`/settings/preferences?preferenceError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/settings/preferences");
  redirect(`/settings/preferences?adminModeUpdated=${encodeURIComponent(mode)}`);
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
