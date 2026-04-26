import { z } from "zod";

export const automationChannelSchema = z.enum(["content", "community", "directories", "outreach"]);
export const trustLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const automationPreferenceSchema = z.object({
  id: z.string().uuid().nullable(),
  productId: z.string().uuid(),
  channel: automationChannelSchema,
  trustLevel: trustLevelSchema,
  dailyAutoActionLimit: z.number().int().min(0).max(50),
  reviewWindowHours: z.number().int().min(0).max(168),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const listAutomationPreferencesSchema = z.object({
  productId: z.string().uuid(),
});

export const updateAutomationPreferenceSchema = z.object({
  productId: z.string().uuid(),
  channel: automationChannelSchema,
  trustLevel: z.coerce.number().int().min(1).max(3).pipe(trustLevelSchema),
  dailyAutoActionLimit: z.coerce.number().int().min(0).max(50),
  reviewWindowHours: z.coerce.number().int().min(0).max(168),
});

export type AutomationChannel = z.infer<typeof automationChannelSchema>;
export type AutomationPreference = z.infer<typeof automationPreferenceSchema>;
export type TrustLevel = z.infer<typeof trustLevelSchema>;
