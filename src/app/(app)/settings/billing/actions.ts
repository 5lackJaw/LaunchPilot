"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BillingService } from "@/server/services/billing-service";

export async function startCheckoutAction(formData: FormData) {
  const tier = String(formData.get("tier") ?? "");

  try {
    const supabase = await createSupabaseServerClient();
    const url = await new BillingService(supabase).createCheckoutSession({
      tier,
    });
    redirect(url);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect("/settings/billing?billingError=checkout");
  }
}

export async function openCustomerPortalAction() {
  try {
    const supabase = await createSupabaseServerClient();
    const url = await new BillingService(
      supabase,
    ).createCustomerPortalSession();
    redirect(url);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect("/settings/billing?billingError=portal");
  }
}

function isRedirectError(error: unknown) {
  return (
    error instanceof Error &&
    "digest" in error &&
    String(error.digest).startsWith("NEXT_REDIRECT")
  );
}
