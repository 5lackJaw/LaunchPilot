import { CreditCard, ShieldCheck } from "lucide-react";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  openCustomerPortalAction,
  startCheckoutAction,
} from "@/app/(app)/settings/billing/actions";
import type { BillingProfile } from "@/server/schemas/billing";
import { AuthRequiredError } from "@/server/services/auth-service";
import {
  BillingError,
  BillingService,
} from "@/server/services/billing-service";

type PageProps = {
  searchParams: Promise<{
    checkout?: string;
    billingError?: string;
  }>;
};

export default async function BillingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadBillingData();
  const profile = data.profile;

  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar
        title="Settings"
        eyebrow="Billing"
        actions={
          profile ? (
            <Badge variant="secondary">{profile.planTier} plan</Badge>
          ) : null
        }
      />

      <section className="grid gap-4 p-6 xl:grid-cols-[1fr_340px]">
        {params.checkout === "success" ? (
          <Alert className="xl:col-span-2">
            <AlertTitle>Checkout completed</AlertTitle>
            <AlertDescription>
              Stripe will confirm the subscription by webhook and update your
              plan.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.checkout === "cancelled" ? (
          <Alert className="xl:col-span-2">
            <AlertTitle>Checkout cancelled</AlertTitle>
            <AlertDescription>Your plan was not changed.</AlertDescription>
          </Alert>
        ) : null}
        {params.billingError || data.error ? (
          <Alert variant="destructive" className="xl:col-span-2">
            <AlertTitle>Billing could not be loaded</AlertTitle>
            <AlertDescription>
              {data.error ?? billingErrorMessage(params.billingError)}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4">
          {profile ? (
            <>
              <BillingOverview profile={profile} />
              {profile.checkoutPlans.map((plan) => (
                <PlanCard key={plan.tier} profile={profile} plan={plan} />
              ))}
            </>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Stripe status</CardTitle>
              <CardDescription>
                Billing actions stay server-authoritative.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <StatusRow
                label="Stripe API"
                enabled={Boolean(profile?.stripeConfigured)}
              />
              <StatusRow
                label="Customer portal"
                enabled={Boolean(profile?.portalAvailable)}
              />
              <p>
                Plan changes are finalized from signed Stripe webhook events.
              </p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}

function BillingOverview({ profile }: { profile: BillingProfile }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Current plan</CardTitle>
            <CardDescription>
              {profile.email ?? "Signed-in LaunchPilot account"}
            </CardDescription>
          </div>
          <Badge
            variant={profile.planTier === "free" ? "secondary" : "success"}
          >
            {profile.planTier}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {profile.stripeCustomerId
            ? "Stripe customer is linked for this account."
            : "No Stripe customer has been created yet."}
        </p>
        <form action={openCustomerPortalAction}>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={!profile.portalAvailable}
          >
            Open portal
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PlanCard({
  profile,
  plan,
}: {
  profile: BillingProfile;
  plan: BillingProfile["checkoutPlans"][number];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CreditCard
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <CardTitle>{plan.label}</CardTitle>
            </div>
            <CardDescription className="mt-1">
              {plan.description}
            </CardDescription>
          </div>
          {plan.current ? <Badge variant="success">current</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant={plan.priceIdConfigured ? "secondary" : "warning"}>
            {plan.priceIdConfigured ? "price configured" : "price missing"}
          </Badge>
          <Badge variant="outline">subscription</Badge>
        </div>
        <form action={startCheckoutAction}>
          <input type="hidden" name="tier" value={plan.tier} />
          <Button
            type="submit"
            size="sm"
            disabled={
              !profile.stripeConfigured ||
              !plan.priceIdConfigured ||
              plan.current
            }
          >
            {plan.current ? "Current plan" : "Start checkout"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StatusRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
      <span>{label}</span>
      <Badge variant={enabled ? "success" : "warning"}>
        <ShieldCheck className="mr-1 size-3" aria-hidden="true" />
        {enabled ? "ready" : "not ready"}
      </Badge>
    </div>
  );
}

async function loadBillingData(): Promise<{
  profile: BillingProfile | null;
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const profile = await new BillingService(supabase).getBillingProfile();
    return { profile, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { profile: null, error: error.message };
    }

    if (error instanceof BillingError) {
      return { profile: null, error: error.message };
    }

    if (
      error instanceof Error &&
      error.message.includes("Supabase URL and publishable key")
    ) {
      return {
        profile: null,
        error:
          "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}

function billingErrorMessage(value: string | undefined) {
  if (value === "portal") {
    return "The customer portal could not be opened. Confirm Stripe is configured and a customer exists.";
  }

  if (value === "checkout") {
    return "Checkout could not be started. Confirm Stripe and the selected price ID are configured.";
  }

  return "Billing action failed.";
}
