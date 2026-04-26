import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import { createStripeClient } from "@/lib/stripe";
import {
  billingProfileSchema,
  checkoutPlanInputSchema,
} from "@/server/schemas/billing";
import type {
  BillingProfile,
  PaidPlanTier,
  PlanTier,
} from "@/server/schemas/billing";
import { AuthService } from "@/server/services/auth-service";

const paidPlanConfig: Record<
  PaidPlanTier,
  {
    label: string;
    description: string;
    priceId?: string;
  }
> = {
  launch: {
    label: "Launch",
    description: "For one active product with higher monthly execution limits.",
    priceId: env.STRIPE_LAUNCH_PRICE_ID,
  },
  growth: {
    label: "Growth",
    description: "For multiple products and heavier monthly automation usage.",
    priceId: env.STRIPE_GROWTH_PRICE_ID,
  },
};

export class BillingService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getBillingProfile(): Promise<BillingProfile> {
    const user = await new AuthService(this.supabase).requireUser();
    const profile = await this.getUserBillingRow(user.id);

    return billingProfileSchema.parse({
      userId: user.id,
      email: user.email ?? profile.email ?? null,
      planTier: parsePlanTier(profile.plan_tier),
      stripeCustomerId: profile.stripe_customer_id,
      stripeConfigured: isStripeConfigured(),
      portalAvailable:
        isStripeConfigured() && Boolean(profile.stripe_customer_id),
      checkoutPlans: (Object.keys(paidPlanConfig) as PaidPlanTier[]).map(
        (tier) => ({
          tier,
          label: paidPlanConfig[tier].label,
          description: paidPlanConfig[tier].description,
          priceIdConfigured: Boolean(paidPlanConfig[tier].priceId),
          current: profile.plan_tier === tier,
        }),
      ),
    });
  }

  async createCheckoutSession(input: unknown): Promise<string> {
    const parsed = checkoutPlanInputSchema.parse(input);
    const priceId = paidPlanConfig[parsed.tier].priceId;

    if (!priceId) {
      throw new BillingError(
        `${paidPlanConfig[parsed.tier].label} price ID is not configured.`,
      );
    }

    const user = await new AuthService(this.supabase).requireUser();
    const profile = await this.getUserBillingRow(user.id);
    const stripe = createStripeClient();
    const customerId = await this.ensureStripeCustomer({
      stripe,
      userId: user.id,
      email: user.email ?? profile.email,
      existingCustomerId: profile.stripe_customer_id,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.NEXT_PUBLIC_APP_URL}/settings/billing?checkout=success`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/settings/billing?checkout=cancelled`,
      metadata: {
        userId: user.id,
        planTier: parsed.tier,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planTier: parsed.tier,
        },
      },
    });

    if (!session.url) {
      throw new BillingError("Stripe did not return a Checkout URL.");
    }

    return session.url;
  }

  async createCustomerPortalSession(): Promise<string> {
    const user = await new AuthService(this.supabase).requireUser();
    const profile = await this.getUserBillingRow(user.id);

    if (!profile.stripe_customer_id) {
      throw new BillingError("No Stripe customer exists for this account yet.");
    }

    const stripe = createStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    });

    return session.url;
  }

  async applyCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const userId = session.metadata?.userId;
    const planTier = parsePlanTier(session.metadata?.planTier);
    const customerId = getCustomerId(session.customer);

    if (!userId || !customerId || planTier === "free") {
      return;
    }

    await this.updateUserBilling({
      userId,
      stripeCustomerId: customerId,
      planTier,
    });
  }

  async applySubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId = getCustomerId(subscription.customer);
    if (!customerId) {
      return;
    }

    const planTier = planTierFromSubscription(subscription);
    await this.updateUserBillingByCustomer({
      stripeCustomerId: customerId,
      planTier,
    });
  }

  private async getUserBillingRow(userId: string): Promise<{
    email: string | null;
    plan_tier: string;
    stripe_customer_id: string | null;
  }> {
    const { data, error } = await this.supabase
      .from("users")
      .select("email,plan_tier,stripe_customer_id")
      .eq("id", userId)
      .single();

    if (error) {
      throw new BillingError(error.message);
    }

    return data;
  }

  private async ensureStripeCustomer(input: {
    stripe: Stripe;
    userId: string;
    email: string | null | undefined;
    existingCustomerId: string | null;
  }): Promise<string> {
    if (input.existingCustomerId) {
      return input.existingCustomerId;
    }

    const customer = await input.stripe.customers.create({
      email: input.email ?? undefined,
      metadata: {
        userId: input.userId,
      },
    });

    await this.updateUserBilling({
      userId: input.userId,
      stripeCustomerId: customer.id,
    });

    return customer.id;
  }

  private async updateUserBilling(input: {
    userId: string;
    stripeCustomerId: string;
    planTier?: PlanTier;
  }): Promise<void> {
    const { error } = await this.supabase
      .from("users")
      .update({
        stripe_customer_id: input.stripeCustomerId,
        ...(input.planTier ? { plan_tier: input.planTier } : {}),
      })
      .eq("id", input.userId);

    if (error) {
      throw new BillingError(error.message);
    }
  }

  private async updateUserBillingByCustomer(input: {
    stripeCustomerId: string;
    planTier: PlanTier;
  }): Promise<void> {
    const { error } = await this.supabase
      .from("users")
      .update({ plan_tier: input.planTier })
      .eq("stripe_customer_id", input.stripeCustomerId);

    if (error) {
      throw new BillingError(error.message);
    }
  }
}

export class BillingError extends Error {
  constructor(message: string) {
    super(`Billing could not be completed: ${message}`);
    this.name = "BillingError";
  }
}

export function isStripeConfigured() {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function isStripeWebhookConfigured() {
  return Boolean(env.STRIPE_WEBHOOK_SECRET);
}

function parsePlanTier(value: unknown): PlanTier {
  if (value === "launch" || value === "growth") {
    return value;
  }

  return "free";
}

function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
) {
  if (!customer) {
    return null;
  }

  return typeof customer === "string" ? customer : customer.id;
}

function planTierFromSubscription(subscription: Stripe.Subscription): PlanTier {
  if (!["active", "trialing"].includes(subscription.status)) {
    return "free";
  }

  const priceId = subscription.items.data[0]?.price.id;
  if (priceId && priceId === env.STRIPE_GROWTH_PRICE_ID) {
    return "growth";
  }

  if (priceId && priceId === env.STRIPE_LAUNCH_PRICE_ID) {
    return "launch";
  }

  return parsePlanTier(subscription.metadata?.planTier);
}
