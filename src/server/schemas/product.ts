import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(120, "Use 120 characters or fewer."),
  url: z.string().trim().url("Enter a full URL, including https://").max(2048, "URL is too long."),
});

export const productSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  url: z.string().url(),
  status: z.enum(["draft", "onboarding", "active", "paused", "archived"]),
  currentMarketingBriefId: z.string().uuid().nullable(),
  createdAt: z.string(),
});

export const productIdSchema = z.object({
  productId: z.string().uuid(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type Product = z.infer<typeof productSchema>;
