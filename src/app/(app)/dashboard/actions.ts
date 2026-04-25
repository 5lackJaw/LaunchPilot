"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AnalyticsService } from "@/server/services/analytics-service";
import { ProductService } from "@/server/services/product-service";

export async function requestWeeklyDigestAction() {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      redirect("/dashboard?digestError=missing-product");
    }

    await new AnalyticsService(supabase).requestWeeklyDigest({ productId: product.id });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect("/dashboard?digestError=1");
  }

  redirect("/dashboard?digestRequested=1");
}

function isRedirectError(error: unknown) {
  return error instanceof Error && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT");
}
