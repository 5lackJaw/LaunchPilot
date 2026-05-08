"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/server/services/auth-service";
import { BriefEditError, BriefGenerationBlockedError, BriefService } from "@/server/services/brief-service";
import { ContentService } from "@/server/services/content-service";
import { DirectoryService } from "@/server/services/directory-service";
import { ProductReadError } from "@/server/services/product-service";
import { ProductService } from "@/server/services/product-service";

export async function requestBriefGenerationAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");

  try {
    const supabase = await createSupabaseServerClient();
    await new BriefService(supabase).requestGeneration({
      productId,
    });
  } catch (error) {
    const message = toBriefRequestMessage(error);
    redirect(`/onboarding/brief?productId=${encodeURIComponent(productId)}&requestError=${encodeURIComponent(message)}`);
  }

  redirect(`/onboarding/brief?productId=${encodeURIComponent(productId)}&requested=1`);
}

export async function saveBriefEditAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");

  try {
    const supabase = await createSupabaseServerClient();
    await new BriefService(supabase).createEditedVersion({
      productId,
      tagline: formData.get("tagline"),
      valueProps: splitLines(formData.get("valueProps")),
      personas: splitLines(formData.get("personas")),
      competitors: splitLines(formData.get("competitors")),
      toneVoice: formData.get("toneVoice"),
      toneAvoid: splitLines(formData.get("toneAvoid")),
    });
  } catch (error) {
    const message = toBriefEditMessage(error);
    redirect(`/onboarding/brief?productId=${encodeURIComponent(productId)}&editError=${encodeURIComponent(message)}`);
  }

  redirect(`/onboarding/brief?productId=${encodeURIComponent(productId)}&edited=1`);
}

export async function startUsingLaunchBeaconAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  let nextPath = "/inbox?firstRun=1";

  try {
    const supabase = await createSupabaseServerClient();
    const productService = new ProductService(supabase);
    const product = await productService.getProduct({ productId });
    await productService.setActiveProduct({ productId: product.id });

    const brief = await new BriefService(supabase).getCurrentBrief({ productId: product.id });
    if (!brief) {
      throw new Error("A Marketing Brief is required before LaunchBeacon can start creating first-run drafts.");
    }

    const queueErrors: string[] = [];
    const contentService = new ContentService(supabase);
    const opportunities = await contentService.listKeywordOpportunities({ productId: product.id });

    for (const opportunity of opportunities.slice(0, 3)) {
      try {
        await contentService.selectKeywordOpportunityAndRequestGeneration({
          productId: product.id,
          opportunityId: opportunity.id,
        });
      } catch (error) {
        queueErrors.push(toFirstRunQueueError(`Article for "${opportunity.targetKeyword}"`, error));
      }
    }

    try {
      await new DirectoryService(supabase).requestPackageGeneration({
        productId: product.id,
        limit: 10,
        reason: "onboarding_first_run",
      });
    } catch (error) {
      queueErrors.push(toFirstRunQueueError("Directory listing packages", error));
    }

    const activeUpdate = await supabase
      .from("products")
      .update({ status: "active" })
      .eq("id", product.id)
      .select("id")
      .single();

    if (activeUpdate.error) {
      throw activeUpdate.error;
    }

    revalidatePath("/inbox");

    if (queueErrors.length) {
      nextPath = `/inbox?firstRun=1&firstRunError=${encodeURIComponent(queueErrors.slice(0, 3).join(" "))}`;
    }
  } catch (error) {
    const message = toStartUsingMessage(error);
    redirect(`/onboarding/brief?productId=${encodeURIComponent(productId)}&startError=${encodeURIComponent(message)}`);
  }

  redirect(nextPath);
}

function toBriefRequestMessage(error: unknown) {
  if (error instanceof ZodError) {
    return "Missing or invalid product ID.";
  }

  if (error instanceof AuthRequiredError) {
    return error.message;
  }

  if (error instanceof ProductReadError || error instanceof BriefGenerationBlockedError) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return "Supabase is not configured yet.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Brief generation could not be requested.";
}

function toBriefEditMessage(error: unknown) {
  if (error instanceof ZodError) {
    return "Check the edited fields and try again.";
  }

  if (error instanceof AuthRequiredError) {
    return error.message;
  }

  if (error instanceof ProductReadError || error instanceof BriefEditError) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return "Supabase is not configured yet.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Brief edit could not be saved.";
}

function toStartUsingMessage(error: unknown) {
  if (error instanceof ZodError) {
    return "Missing or invalid product ID.";
  }

  if (error instanceof AuthRequiredError) {
    return error.message;
  }

  if (error instanceof ProductReadError) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return "Supabase is not configured yet.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "LaunchBeacon could not start the first-run workflow.";
}

function toFirstRunQueueError(label: string, error: unknown) {
  if (error instanceof Error) {
    return `${label}: ${error.message}`;
  }

  return `${label}: could not be queued.`;
}

function splitLines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
