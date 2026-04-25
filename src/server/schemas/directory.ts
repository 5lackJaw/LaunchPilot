import { z } from "zod";

export const directorySubmissionStatusSchema = z.enum(["pending", "submitted", "live", "rejected", "skipped", "failed"]);
export const directorySubmissionMethodSchema = z.enum(["auto_supported", "manual", "assisted"]);

export const directorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  url: z.string().url(),
  categories: z.array(z.string()),
  submissionMethod: directorySubmissionMethodSchema,
  avgDa: z.number().int().min(0).max(100).nullable(),
  avgTrafficTier: z.enum(["low", "medium", "high", "unknown"]),
  reviewTimeDays: z.number().int().min(0).nullable(),
  freeTierAvailable: z.boolean(),
  paidTierPrice: z.number().int().min(0).nullable(),
  active: z.boolean(),
});

export const directorySubmissionSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  directoryId: z.string().uuid(),
  status: directorySubmissionStatusSchema,
  listingPayload: z.record(z.string(), z.unknown()),
  submittedAt: z.string().nullable(),
  liveUrl: z.string().nullable(),
  notes: z.string().nullable(),
  provenance: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const directoryTrackerItemSchema = z.object({
  directory: directorySchema,
  submission: directorySubmissionSchema.nullable(),
});

export const listDirectoryTrackerSchema = z.object({
  productId: z.string().uuid(),
});

export const requestDirectoryPackageGenerationSchema = z.object({
  productId: z.string().uuid(),
});

export const updateDirectorySubmissionStatusSchema = z.object({
  submissionId: z.string().uuid(),
  status: z.enum(["pending", "submitted", "live", "rejected", "skipped", "failed"]),
  notes: z.string().trim().max(1000).optional(),
});

export const autoSubmitDirectorySubmissionSchema = z.object({
  submissionId: z.string().uuid(),
});

export type Directory = z.infer<typeof directorySchema>;
export type DirectorySubmission = z.infer<typeof directorySubmissionSchema>;
export type DirectoryTrackerItem = z.infer<typeof directoryTrackerItemSchema>;
