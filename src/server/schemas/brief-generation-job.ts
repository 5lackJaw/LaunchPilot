import { z } from "zod";

export const briefGenerationJobStatusSchema = z.enum(["queued", "running", "completed", "failed"]);

export const briefGenerationJobStepSchema = z.object({
  label: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
});

export const briefGenerationJobSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  status: briefGenerationJobStatusSchema,
  progressPercent: z.number().int().min(0).max(100),
  steps: z.array(briefGenerationJobStepSchema),
  crawlResultId: z.string().uuid().nullable(),
  marketingBriefId: z.string().uuid().nullable(),
  errorMessage: z.string().nullable(),
  adminOverride: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
});

export type BriefGenerationJob = z.infer<typeof briefGenerationJobSchema>;
