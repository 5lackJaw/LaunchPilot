"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DirectoryService } from "@/server/services/directory-service";
import { ProductService } from "@/server/services/product-service";

export async function requestDirectoryPackagesAction() {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      redirect("/directories?packageError=missing-product");
    }

    await new DirectoryService(supabase).requestPackageGeneration({ productId: product.id });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect("/directories?packageError=1");
  }

  redirect("/directories?packageRequested=1");
}

export async function updateDirectorySubmissionStatusAction(formData: FormData) {
  const submissionId = String(formData.get("submissionId") ?? "");
  const status = String(formData.get("status") ?? "");
  const notes = String(formData.get("notes") ?? "");

  try {
    const supabase = await createSupabaseServerClient();
    await new DirectoryService(supabase).updateSubmissionStatus({
      submissionId,
      status,
      notes: notes || undefined,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect("/directories?statusError=1");
  }

  redirect("/directories?statusUpdated=1");
}

export async function autoSubmitDirectorySubmissionAction(formData: FormData) {
  const submissionId = String(formData.get("submissionId") ?? "");

  try {
    const supabase = await createSupabaseServerClient();
    await new DirectoryService(supabase).autoSubmitSupported({ submissionId });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect("/directories?autoSubmitError=1");
  }

  redirect("/directories?autoSubmitted=1");
}

function isRedirectError(error: unknown) {
  return error instanceof Error && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT");
}
