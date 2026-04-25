"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/server/services/auth-service";
import { ContentAssetReadError, ContentAssetUpdateError, ContentService } from "@/server/services/content-service";

export async function updateContentAssetAction(formData: FormData) {
  const assetId = String(formData.get("assetId") ?? "");
  const title = String(formData.get("title") ?? "");
  const bodyMd = String(formData.get("bodyMd") ?? "");
  const metaTitle = String(formData.get("metaTitle") ?? "").trim();
  const metaDescription = String(formData.get("metaDescription") ?? "").trim();
  let redirectTo = assetId ? `/content/${encodeURIComponent(assetId)}` : "/content";

  try {
    const supabase = await createSupabaseServerClient();
    const asset = await new ContentService(supabase).updateContentAsset({
      assetId,
      title,
      bodyMd,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
    });

    revalidatePath("/content");
    revalidatePath(`/content/${asset.id}`);
    redirectTo = `/content/${asset.id}?saved=1`;
  } catch (error) {
    const message = toUpdateErrorMessage(error);
    redirectTo = assetId
      ? `/content/${encodeURIComponent(assetId)}?saveError=${encodeURIComponent(message)}`
      : `/content?saveError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}

function toUpdateErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the content fields and try again.";
  }

  if (error instanceof AuthRequiredError) {
    return error.message;
  }

  if (error instanceof ContentAssetReadError || error instanceof ContentAssetUpdateError) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return "Supabase is not configured yet.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Content asset could not be saved.";
}
