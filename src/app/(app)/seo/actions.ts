"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/server/services/auth-service";
import { ContentAssetCreateError, ContentAssetReadError, ContentService } from "@/server/services/content-service";

export async function selectKeywordOpportunityAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const opportunityId = String(formData.get("opportunityId") ?? "");
  let redirectTo = "/seo";

  try {
    const supabase = await createSupabaseServerClient();
    const asset = await new ContentService(supabase).selectKeywordOpportunity({ productId, opportunityId });

    revalidatePath("/seo");
    revalidatePath("/content");
    redirectTo = `/content/${asset.id}?selected=1`;
  } catch (error) {
    const message = toSelectionErrorMessage(error);
    redirectTo = `/seo?selectionError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}

function toSelectionErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return "Choose a valid keyword opportunity.";
  }

  if (error instanceof AuthRequiredError) {
    return error.message;
  }

  if (error instanceof ContentAssetCreateError || error instanceof ContentAssetReadError) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return "Supabase is not configured yet.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Keyword opportunity could not be selected.";
}
