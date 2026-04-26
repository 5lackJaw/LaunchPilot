import { z } from "zod";

export const planTierSchema = z.enum(["free", "launch", "growth"]);
export const paidPlanTierSchema = z.enum(["launch", "growth"]);

export const billingProfileSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email().nullable(),
  planTier: planTierSchema,
  stripeCustomerId: z.string().nullable(),
  stripeConfigured: z.boolean(),
  portalAvailable: z.boolean(),
  checkoutPlans: z.array(
    z.object({
      tier: paidPlanTierSchema,
      label: z.string(),
      description: z.string(),
      priceIdConfigured: z.boolean(),
      current: z.boolean(),
    }),
  ),
});

export const checkoutPlanInputSchema = z.object({
  tier: paidPlanTierSchema,
});

export type BillingProfile = z.infer<typeof billingProfileSchema>;
export type PlanTier = z.infer<typeof planTierSchema>;
export type PaidPlanTier = z.infer<typeof paidPlanTierSchema>;
