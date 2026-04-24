import { z } from "zod";

export const inboxItemTypeSchema = z.enum([
  "content_draft",
  "community_reply",
  "directory_package",
  "outreach_email",
  "positioning_update",
  "weekly_recommendation",
]);

export const inboxItemStatusSchema = z.enum(["pending_review", "approved", "rejected", "skipped", "executed"]);

export const inboxItemSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  productId: z.string().uuid(),
  type: inboxItemTypeSchema,
  status: inboxItemStatusSchema,
  title: z.string().min(1),
  preview: z.string(),
  confidence: z.number().min(0).max(1),
  estimatedImpact: z.enum(["low", "medium", "high"]),
});

export type InboxItem = z.infer<typeof inboxItemSchema>;
