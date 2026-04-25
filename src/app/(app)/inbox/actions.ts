"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/server/services/auth-service";
import { InboxItemReadError, InboxItemReviewError, InboxService } from "@/server/services/inbox-service";

export async function batchApproveInboxItemsAction(formData: FormData) {
  const inboxItemIds = formData.getAll("inboxItemIds").map(String).filter(Boolean);

  try {
    const supabase = await createSupabaseServerClient();
    const approvedItems = await new InboxService(supabase).batchApproveSupported({ inboxItemIds });

    revalidatePath("/inbox");
    for (const item of approvedItems) {
      revalidatePath(`/inbox/${item.id}`);
    }

    redirect(`/inbox?batchApproved=${approvedItems.length}`);
  } catch (error) {
    const message = toBatchErrorMessage(error);
    redirect(`/inbox?batchError=${encodeURIComponent(message)}`);
  }
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
