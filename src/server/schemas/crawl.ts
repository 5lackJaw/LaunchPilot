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

export type CrawlJob = z.infer<typeof crawlJobSchema>;
