"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/server/services/auth-service";
import { InboxItemReadError, InboxItemReviewError, InboxService } from "@/server/services/inbox-service";
import { isDevInboxSeedEnabled } from "@/server/dev-flags";

export async function batchApproveInboxItemsAction(formData: FormData) {
  const inboxItemIds = formData.getAll("inboxItemIds").map(String).filter(Boolean);
  let redirectTo = "/inbox";

  try {
    const supabase = await createSupabaseServerClient();
    const approvedItems = await new InboxService(supabase).batchApproveSupported({ inboxItemIds });

    revalidatePath("/inbox");
    for (const item of approvedItems) {
      revalidatePath(`/inbox/${item.id}`);
    }

    redirectTo = `/inbox?batchApproved=${approvedItems.length}`;
  } catch (error) {
    const message = toBatchErrorMessage(error);
    redirectTo = `/inbox?batchError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}

export async function seedDevInboxItemsAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  let redirectTo = "/inbox";

  try {
    assertDevInboxSeedEnabled();
    const supabase = await createSupabaseServerClient();
    const inbox = new InboxService(supabase);
    await inbox.deleteDevSeedItems({ productId });

    for (const item of createDevSeedItems(productId)) {
      await inbox.createItem(item);
    }

    revalidatePath("/inbox");
    redirectTo = "/inbox?devSeeded=1";
  } catch (error) {
    const message = toDevSeedErrorMessage(error);
    redirectTo = `/inbox?devSeedError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}

export async function clearDevInboxItemsAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  let redirectTo = "/inbox";

  try {
    assertDevInboxSeedEnabled();
    const supabase = await createSupabaseServerClient();
    const deletedCount = await new InboxService(supabase).deleteDevSeedItems({ productId });

    revalidatePath("/inbox");
    redirectTo = `/inbox?devSeedCleared=${deletedCount}`;
  } catch (error) {
    const message = toDevSeedErrorMessage(error);
    redirectTo = `/inbox?devSeedError=${encodeURIComponent(message)}`;
  }

  redirect(redirectTo);
}

function toBatchErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return "Select at least one supported inbox item.";
  }

  if (error instanceof AuthRequiredError) {
    return error.message;
  }

  if (error instanceof InboxItemReadError || error instanceof InboxItemReviewError) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return "Supabase is not configured yet.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Batch approval failed.";
}

function assertDevInboxSeedEnabled() {
  if (!isDevInboxSeedEnabled()) {
    throw new Error("Development inbox seeding is disabled. Set ENABLE_DEV_INBOX_SEED=1 locally to use it.");
  }
}

function toDevSeedErrorMessage(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return error.message;
  }

  if (error instanceof InboxItemReadError || error instanceof InboxItemReviewError) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return "Supabase is not configured yet.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Development inbox seed action failed.";
}

function createDevSeedItems(productId: string) {
  return [
    {
      productId,
      itemType: "content_draft" as const,
      sourceEntityType: "dev_seed",
      payload: {
        title: "How to invoice clients in USDC: a freelancer's guide",
        preview: "1,840 words targeting high-intent freelancer searches.",
        body: "Draft article body for testing the content review surface.\n\nThis seed item is tagged dev_seed and should be cleared after testing.",
        targetKeyword: "usdc invoice freelancer",
        suggestedAction: "Review and approve the content draft.",
        metadata: { devSeed: true },
      },
      aiConfidence: 0.92,
      impactEstimate: "high" as const,
      reviewTimeEstimateSeconds: 480,
    },
    {
      productId,
      itemType: "community_reply" as const,
      sourceEntityType: "dev_seed",
      payload: {
        title: 'r/freelance - "Anyone accepting crypto payments yet?"',
        preview: "Helpful Reddit reply draft with relevance score 82.",
        body: "A non-promotional reply draft for testing community review.",
        platform: "Reddit",
        threadUrl: "https://reddit.com/r/freelance/example",
        promotionalRisk: "low",
        metadata: { devSeed: true },
      },
      aiConfidence: 0.82,
      impactEstimate: "medium" as const,
      reviewTimeEstimateSeconds: 180,
    },
    {
      productId,
      itemType: "directory_package" as const,
      sourceEntityType: "dev_seed",
      payload: {
        title: "ProductHunt launch package",
        preview: "Directory package with tagline, description, and launch notes.",
        body: "Tagline: USDC invoicing for freelancers\n\nDescription: A concise listing package for testing directory review.",
        directory: "ProductHunt",
        submissionMethod: "manual review",
        metadata: { devSeed: true },
      },
      aiConfidence: 0.9,
      impactEstimate: "high" as const,
      reviewTimeEstimateSeconds: 300,
    },
  ];
}
