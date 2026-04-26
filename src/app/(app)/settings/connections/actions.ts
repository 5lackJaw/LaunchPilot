"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ConnectionsService } from "@/server/services/connections-service";

export async function requestConnectionSetupAction(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");

  try {
    const supabase = await createSupabaseServerClient();
    await new ConnectionsService(supabase).requestSetup({ provider });
    revalidatePath("/settings/connections");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect("/settings/connections?connectionError=1");
  }

  redirect(
    `/settings/connections?setupRequested=${encodeURIComponent(provider)}`,
  );
}

export async function revokeConnectionAction(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");

  try {
    const supabase = await createSupabaseServerClient();
    await new ConnectionsService(supabase).revokeConnection({ provider });
    revalidatePath("/settings/connections");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect("/settings/connections?connectionError=1");
  }

  redirect(`/settings/connections?revoked=${encodeURIComponent(provider)}`);
}

function isRedirectError(error: unknown) {
  return (
    error instanceof Error &&
    "digest" in error &&
    String(error.digest).startsWith("NEXT_REDIRECT")
  );
}
