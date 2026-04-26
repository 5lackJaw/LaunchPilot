"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/server/services/auth-service";
import { CommunityReplyPostError, CommunityService } from "@/server/services/community-service";
import { InboxItemReadError, InboxItemReviewError, InboxService } from "@/server/services/inbox-service";
import { OutreachSendError, OutreachService } from "@/server/services/outreach-service";

export async function reviewInboxItemAction(formData: FormData) {
  const inboxItemId = String(formData.get("inboxItemId") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  try {
    const supabase = await createSupabaseServerClient();
    const inbox = new InboxService(supabase);
    const currentItem = await inbox.getItem({ inboxItemId });

    if (
      status === "approved" &&
      currentItem.itemType === "community_reply" &&
      currentItem.sourceEntityType === "community_thread" &&
      currentItem.sourceEntityId
    ) {
      if (currentItem.status !== "pending") {
        throw new InboxItemReviewError("Only pending inbox items can be reviewed.");
      }

      await new CommunityService(supabase).postApprovedReply({ threadId: currentItem.sourceEntityId });
    }

    if (
      status === "approved" &&
      currentItem.itemType === "outreach_email" &&
      currentItem.sourceEntityType === "outreach_contact" &&
      currentItem.sourceEntityId
    ) {
      if (currentItem.status !== "pending") {
        throw new InboxItemReviewError("Only pending inbox items can be reviewed.");
      }

      await new OutreachService(supabase).sendApprovedEmail({ contactId: currentItem.sourceEntityId });
    }

    await inbox.reviewItem({
      inboxItemId,
      status,
      reason: reason || undefined,
    });
  } catch (error) {
    const message = toReviewErrorMessage(error);
    redirect(`/inbox/${encodeURIComponent(inboxItemId)}?reviewError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/inbox");
  revalidatePath(`/inbox/${inboxItemId}`);
  redirect(`/inbox/${encodeURIComponent(inboxItemId)}?reviewed=${encodeURIComponent(status)}`);
}

function toReviewErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return "Check the review action and try again.";
  }

  if (error instanceof AuthRequiredError) {
    return error.message;
  }

  if (error instanceof InboxItemReadError || error instanceof InboxItemReviewError) {
    return error.message;
  }

  if (error instanceof CommunityReplyPostError) {
    return error.message;
  }

  if (error instanceof OutreachSendError) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return "Supabase is not configured yet.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Inbox item review failed.";
}
