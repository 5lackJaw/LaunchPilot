import { z } from "zod";

export const communityThreadStatusSchema = z.enum(["observed", "drafted", "pending_review", "approved", "posted", "skipped", "blocked", "failed"]);

export const communityThreadSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  platform: z.string(),
  threadUrl: z.string().url(),
  threadTitle: z.string(),
  threadAuthorHandle: z.string().nullable(),
  relevanceScore: z.number().min(0).max(1),
  painSignalScore: z.number().min(0).max(1),
  audienceFitScore: z.number().min(0).max(1),
  recencyScore: z.number().min(0).max(1),
  replyDraft: z.string().nullable(),
  promotionalScore: z.number().min(0).max(1).nullable(),
  status: communityThreadStatusSchema,
  postedAt: z.string().nullable(),
  provenance: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const listCommunityThreadsSchema = z.object({
  productId: z.string().uuid(),
  status: communityThreadStatusSchema.optional(),
});

export const requestCommunityThreadIngestionSchema = z.object({
  productId: z.string().uuid(),
});

export const requestCommunityReplyGenerationSchema = z.object({
  threadId: z.string().uuid(),
});

export const postCommunityReplySchema = z.object({
  threadId: z.string().uuid(),
});

export type CommunityThread = z.infer<typeof communityThreadSchema>;
