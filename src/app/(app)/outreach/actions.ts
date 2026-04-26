"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OutreachService } from "@/server/services/outreach-service";
import { ProductService } from "@/server/services/product-service";

export async function requestProspectIdentificationAction() {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      redirect("/outreach?prospectError=missing-product");
    }

    await new OutreachService(supabase).requestProspectIdentification({ productId: product.id });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect("/outreach?prospectError=1");
  }

  redirect("/outreach?prospectRequested=1");
}

function isRedirectError(error: unknown) {
  return error instanceof Error && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT");
}
