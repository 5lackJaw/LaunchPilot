import { z } from "zod";

export const inboxItemTypeSchema = z.enum([
  "content_draft",
  "community_reply",
  "directory_package",
  "outreach_email",
  "positioning_update",
  "weekly_recommendation",
]);

export const inboxItemStatusSchema = z.enum(["pending", "approved", "rejected", "skipped", "auto_executed", "failed"]);
export const inboxImpactEstimateSchema = z.enum(["low", "medium", "high"]);
export const inboxItemEventTypeSchema = z.enum(["created", "approved", "rejected", "skipped", "auto_executed", "failed"]);

const inboxPayloadSchema = z
  .object({
    title: z.string().optional(),
    preview: z.string().optional(),
    body: z.string().optional(),
    suggestedAction: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const inboxItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  itemType: inboxItemTypeSchema,
  sourceEntityType: z.string().nullable(),
  sourceEntityId: z.string().uuid().nullable(),
  payload: inboxPayloadSchema,
  status: inboxItemStatusSchema,
  aiConfidence: z.number().min(0).max(1).nullable(),
  impactEstimate: inboxImpactEstimateSchema,
  reviewTimeEstimateSeconds: z.number().int().min(0).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  reviewedAt: z.string().nullable(),
});

export const inboxItemEventSchema = z.object({
  id: z.string().uuid(),
  inboxItemId: z.string().uuid(),
  productId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable(),
  eventType: inboxItemEventTypeSchema,
  reason: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export const createInboxItemSchema = z.object({
  productId: z.string().uuid(),
  itemType: inboxItemTypeSchema,
  sourceEntityType: z.string().trim().min(1).max(80).nullable().optional(),
  sourceEntityId: z.string().uuid().nullable().optional(),
  payload: inboxPayloadSchema,
  aiConfidence: z.number().min(0).max(1).nullable().optional(),
  impactEstimate: inboxImpactEstimateSchema.default("medium"),
  reviewTimeEstimateSeconds: z.number().int().min(0).nullable().optional(),
});

export const listInboxItemsSchema = z.object({
  productId: z.string().uuid(),
  status: inboxItemStatusSchema.optional(),
});

export const reviewInboxItemSchema = z.object({
  inboxItemId: z.string().uuid(),
  status: z.enum(["approved", "skipped", "rejected"]),
  reason: z.string().trim().max(1000).optional(),
});

export const batchApproveInboxItemsSchema = z.object({
  inboxItemIds: z.array(z.string().uuid()).min(1).max(25),
});

export type InboxItem = z.infer<typeof inboxItemSchema>;
export type InboxItemEvent = z.infer<typeof inboxItemEventSchema>;
export type CreateInboxItemInput = z.infer<typeof createInboxItemSchema>;
export type ListInboxItemsInput = z.infer<typeof listInboxItemsSchema>;
export type ReviewInboxItemInput = z.infer<typeof reviewInboxItemSchema>;
export type BatchApproveInboxItemsInput = z.infer<typeof batchApproveInboxItemsSchema>;
