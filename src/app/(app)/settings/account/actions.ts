"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccountService, accountErrorMessage } from "@/server/services/account-service";

export async function deleteAccountAction(formData: FormData) {
  const confirmation = String(formData.get("confirmation") ?? "");

  try {
    const supabase = await createSupabaseServerClient();
    await new AccountService(supabase).deleteAccount({ confirmation });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = accountErrorMessage(error) ?? "Account deletion failed.";
    redirect(`/settings/account?deleteError=${encodeURIComponent(message)}`);
  }

  redirect("/login?accountDeleted=1");
}

function isRedirectError(error: unknown) {
  return (
    error instanceof Error &&
    "digest" in error &&
    String(error.digest).startsWith("NEXT_REDIRECT")
  );
}
