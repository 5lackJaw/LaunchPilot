"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CommunityService } from "@/server/services/community-service";
import { ProductService } from "@/server/services/product-service";

export async function requestCommunityThreadIngestionAction() {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      redirect("/community?ingestionError=missing-product");
    }

    await new CommunityService(supabase).requestThreadIngestion({ productId: product.id });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect("/community?ingestionError=1");
  }

  redirect("/community?ingestionRequested=1");
}

export async function requestCommunityReplyGenerationAction(formData: FormData) {
  const threadId = String(formData.get("threadId") ?? "");

  try {
    const supabase = await createSupabaseServerClient();
    await new CommunityService(supabase).requestReplyGeneration({ threadId });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect("/community?draftError=1");
  }

  redirect("/community?draftRequested=1");
}

function isRedirectError(error: unknown) {
  return error instanceof Error && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT");
}
