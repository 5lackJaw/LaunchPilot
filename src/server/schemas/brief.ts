import { z } from "zod";

export const marketingBriefSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  version: z.number().int().positive(),
  tagline: z.string(),
  valueProps: z.array(z.string()),
  personas: z.array(z.string()),
  competitors: z.array(z.string()),
  keywordClusters: z.array(
    z.object({
      name: z.string(),
      keywords: z.array(z.string()),
    }),
  ),
  toneProfile: z.object({
    voice: z.string(),
    avoid: z.array(z.string()),
  }),
  channelsRanked: z.array(
    z.object({
      channel: z.string(),
      rationale: z.string(),
    }),
  ),
  contentCalendarSeed: z.array(
    z.object({
      title: z.string(),
      format: z.string(),
      rationale: z.string(),
    }),
  ),
  launchDate: z.string().nullable(),
  provenance: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type MarketingBrief = z.infer<typeof marketingBriefSchema>;
