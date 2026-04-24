import { z } from "zod";

export const crawlJobStatusSchema = z.enum(["queued", "running", "completed", "failed"]);

export const crawlJobStepSchema = z.object({
  label: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
});

export const crawlJobSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  status: crawlJobStatusSchema,
  progressPercent: z.number().int().min(0).max(100),
  steps: z.array(crawlJobStepSchema),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
});

export const crawlResultSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  crawlJobId: z.string().uuid(),
  sourceUrl: z.string().url(),
  finalUrl: z.string().url().nullable(),
  httpStatus: z.number().int().min(100).max(599).nullable(),
  pageTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  h1: z.string().nullable(),
  extractedSignals: z.record(z.string(), z.unknown()),
  provenance: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export type CrawlJob = z.infer<typeof crawlJobSchema>;
export type CrawlResult = z.infer<typeof crawlResultSchema>;
