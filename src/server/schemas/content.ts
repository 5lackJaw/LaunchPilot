import { z } from "zod";

export const contentAssetTypeSchema = z.enum(["article", "comparison", "faq", "changelog", "positioning_copy"]);
export const contentAssetStatusSchema = z.enum(["draft", "pending_review", "approved", "published", "rejected", "failed", "archived"]);

export const keywordOpportunitySchema = z.object({
  id: z.string().min(1),
  productId: z.string().uuid(),
  briefVersion: z.number().int().positive(),
  source: z.enum(["keyword_cluster", "content_calendar_seed"]),
  clusterName: z.string().nullable(),
  title: z.string(),
  targetKeyword: z.string(),
  type: contentAssetTypeSchema,
  rationale: z.string(),
  priorityScore: z.number().int().min(0).max(100),
});

export const contentAssetSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  briefVersion: z.number().int().positive(),
  type: contentAssetTypeSchema,
  title: z.string(),
  bodyMd: z.string(),
  targetKeyword: z.string().nullable(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  status: contentAssetStatusSchema,
  publishedUrl: z.string().nullable(),
  aiConfidence: z.number().min(0).max(1).nullable(),
  provenance: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const listKeywordOpportunitiesSchema = z.object({
  productId: z.string().uuid(),
});

export const selectKeywordOpportunitySchema = z.object({
  productId: z.string().uuid(),
  opportunityId: z.string().trim().min(1).max(240),
});

export const listContentAssetsSchema = z.object({
  productId: z.string().uuid(),
  status: contentAssetStatusSchema.optional(),
});

export type KeywordOpportunity = z.infer<typeof keywordOpportunitySchema>;
export type ContentAsset = z.infer<typeof contentAssetSchema>;
export type ContentAssetType = z.infer<typeof contentAssetTypeSchema>;
