import { NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "@/config/env";
import { createStripeClient } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  BillingService,
  isStripeWebhookConfigured,
} from "@/server/services/billing-service";

export async function POST(request: Request) {
  if (!isStripeWebhookConfigured()) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 },
    );
  }

  const stripe = createStripeClient();
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid Stripe signature." },
      { status: 400 },
    );
  }

  const billing = new BillingService(createSupabaseAdminClient());

  switch (event.type) {
    case "checkout.session.completed":
      await billing.applyCheckoutCompleted(event.data.object);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await billing.applySubscriptionUpdated(event.data.object);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
