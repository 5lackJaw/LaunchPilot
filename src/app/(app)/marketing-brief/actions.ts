"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/server/services/auth-service";
import { BriefEditError, BriefGenerationBlockedError, BriefGenerationRequestError, BriefService } from "@/server/services/brief-service";
import { CrawlService, CrawlStartBlockedError, CrawlStartError } from "@/server/services/crawl-service";
import { PlanLimitError } from "@/server/services/plan-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

export async function generateMarketingBriefNowAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  let redirectTo = "/marketing-brief";

  try {
    const supabase = await createSupabaseServerClient();
    await new BriefService(supabase).requestGeneration({
      productId,
      adminOverride: formData.get("adminOverride") === "1",
    });

    revalidatePath("/marketing-brief");
    revalidatePath("/seo");
    redirectTo = "/marketing-brief?generationStarted=1";
  } catch (error) {
    const message = toBriefGenerationMessage(error);
    redirectTo = `/marketing-brief?generationError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}

export async function saveMarketingBriefAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  let redirectTo = "/marketing-brief";

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

    revalidatePath("/marketing-brief");
    revalidatePath("/seo");
    redirectTo = "/marketing-brief?saved=1";
  } catch (error) {
    const message = toBriefEditMessage(error);
    redirectTo = `/marketing-brief?saveError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}

export async function setCurrentMarketingBriefVersionAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const briefId = String(formData.get("briefId") ?? "");
  let redirectTo = "/marketing-brief";

  try {
    const supabase = await createSupabaseServerClient();
    await new BriefService(supabase).setCurrentBriefVersion({ productId, briefId });
    revalidatePath("/marketing-brief");
    revalidatePath("/seo");
    redirectTo = "/marketing-brief?versionChanged=1";
  } catch (error) {
    const message = toBriefEditMessage(error);
    redirectTo = `/marketing-brief?saveError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}

export async function crawlProductForBriefAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  let redirectTo = "/marketing-brief";

  try {
    const supabase = await createSupabaseServerClient();
    const job = await new CrawlService(supabase).startCrawl({
      productId,
      adminOverride: formData.get("adminOverride") === "1",
    });

    revalidatePath("/marketing-brief");
    redirectTo = `/marketing-brief?crawlStarted=1&crawlJobId=${job.id}`;
  } catch (error) {
    const message = toCrawlMessage(error);
    redirectTo = `/marketing-brief?crawlError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}

export async function cancelCrawlForBriefAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");

  try {
    const supabase = await createSupabaseServerClient();
    await new ProductService(supabase).getProduct({ productId });
    await supabase
      .from("crawl_jobs")
      .update({
        status: "failed",
        error_message: "Cancelled by user.",
        completed_at: new Date().toISOString(),
      })
      .eq("product_id", productId)
      .in("status", ["queued", "running"]);
    revalidatePath("/marketing-brief");
  } catch {
    // Keep cancellation best-effort; the workflow runner remains server-authoritative.
  }

  redirect("/marketing-brief");
}

export async function cancelBriefGenerationForBriefAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");

  try {
    const supabase = await createSupabaseServerClient();
    await new ProductService(supabase).getProduct({ productId });
    await supabase
      .from("brief_generation_jobs")
      .update({
        status: "failed",
        error_message: "Cancelled by user.",
        completed_at: new Date().toISOString(),
      })
      .eq("product_id", productId)
      .in("status", ["queued", "running"]);
    revalidatePath("/marketing-brief");
  } catch {
    // Keep cancellation best-effort; the workflow runner remains server-authoritative.
  }

  redirect("/marketing-brief");
}

function toBriefGenerationMessage(error: unknown) {
  if (error instanceof ZodError) {
    return "Missing or invalid product ID.";
  }

  if (error instanceof AuthRequiredError) {
    return error.message;
  }

  if (error instanceof ProductReadError || error instanceof BriefGenerationRequestError || error instanceof BriefGenerationBlockedError) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return "Supabase is not configured yet.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Marketing Brief could not be generated.";
}

function toBriefEditMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the edited fields and try again.";
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

  return "Marketing Brief could not be saved.";
}

function toCrawlMessage(error: unknown) {
  if (error instanceof ZodError) {
    return "Missing or invalid product ID.";
  }

  if (error instanceof AuthRequiredError) {
    return error.message;
  }

  if (error instanceof ProductReadError || error instanceof CrawlStartError || error instanceof CrawlStartBlockedError || error instanceof PlanLimitError) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return "Supabase is not configured yet.";
  }

  if (error instanceof Error && error.message.toLowerCase().includes("inngest")) {
    return "The crawl job could not be sent to the workflow runner. Check Inngest settings.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Crawl could not be started.";
}

function splitLines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
