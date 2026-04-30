import { AppTopbar } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

const USAGE_ITEMS = [
  { label: "Content drafts", used: 11, total: 16 },
  { label: "Community replies", used: 22, total: 30 },
  { label: "Outreach contacts", used: 14, total: 20 },
  { label: "Products", used: 1, total: 3 },
];

const PLAN_TABLE = [
  {
    name: "Seed",
    price: "$9/mo",
    tier: "seed" as const,
    features: ["4 drafts", "10 replies", "5 contacts", "1 product"],
  },
  {
    name: "Launch",
    price: "$39/mo",
    tier: "launch" as const,
    features: ["16 drafts", "30 replies", "20 contacts", "3 products"],
    current: true,
  },
  {
    name: "Growth",
    price: "$99/mo",
    tier: "growth" as const,
    features: ["Unlimited drafts", "Unlimited replies", "100 contacts", "10 products"],
  },
];

const RECENT_INVOICES = [
  { date: "Apr 15, 2026", amount: "$39.00" },
  { date: "Mar 15, 2026", amount: "$39.00" },
  { date: "Feb 15, 2026", amount: "$39.00" },
];

export default async function BillingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadBillingData();
  const profile = data.profile;

  // Determine current plan tier from real data
  const currentTier = profile?.planTier ?? "launch";

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <AppTopbar
        title="Settings"
        eyebrow="Billing"
        actions={
          profile ? (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "5px", padding: "3px 8px" }}>
              {profile.planTier} plan
            </span>
          ) : null
        }
      />

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 320px", overflow: "hidden" }}>
        {/* LEFT COLUMN */}
        <div style={{ overflowY: "auto", padding: "22px 28px 40px", display: "flex", flexDirection: "column", gap: "22px" }}>
          {params.checkout === "success" && (
            <Alert>
              <AlertTitle>Checkout completed</AlertTitle>
              <AlertDescription>Stripe will confirm the subscription by webhook and update your plan.</AlertDescription>
            </Alert>
          )}
          {params.checkout === "cancelled" && (
            <Alert>
              <AlertTitle>Checkout cancelled</AlertTitle>
              <AlertDescription>Your plan was not changed.</AlertDescription>
            </Alert>
          )}
          {(params.billingError || data.error) && (
            <Alert variant="destructive">
              <AlertTitle>Billing could not be loaded</AlertTitle>
              <AlertDescription>{data.error ?? billingErrorMessage(params.billingError)}</AlertDescription>
            </Alert>
          )}

          {/* Current plan card */}
          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", padding: "20px" }}>
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "22px", color: "var(--lp-text)", marginBottom: "6px" }}>
                {currentTier === "launch" ? "Launch · $39/mo" : currentTier === "growth" ? "Growth · $99/mo" : "Seed · $9/mo"}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)" }}>Active · renews May 15, 2026</div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <form action={openCustomerPortalAction}>
                <button
                  type="submit"
                  disabled={!profile?.portalAvailable}
                  style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, color: "#fff", background: "var(--lp-purple)", border: "none", borderRadius: "6px", padding: "7px 14px", cursor: profile?.portalAvailable ? "pointer" : "default", opacity: profile?.portalAvailable ? 1 : 0.5 }}
                >
                  Manage billing
                </button>
              </form>
              <button
                type="button"
                style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, color: "var(--lp-text)", background: "transparent", border: "1px solid var(--lp-border)", borderRadius: "6px", padding: "7px 14px", cursor: "pointer" }}
              >
                Change plan
              </button>
            </div>
          </div>

          {/* Usage section */}
          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Usage this period</div>
            </div>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {USAGE_ITEMS.map((item) => {
                const pct = Math.round((item.used / item.total) * 100);
                const barColor = pct >= 90 ? "var(--lp-red, #F06060)" : pct >= 70 ? "var(--lp-amber)" : "var(--lp-teal)";
                return (
                  <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-text)" }}>{item.label}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)" }}>{item.used} / {item.total}</span>
                    </div>
                    <div style={{ height: "6px", background: "var(--lp-bg4)", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: "3px" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plan comparison table */}
          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Plan comparison</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 400, textAlign: "left", borderBottom: "1px solid var(--lp-border)" }}>Feature</th>
                  {PLAN_TABLE.map((plan) => (
                    <th
                      key={plan.tier}
                      style={{
                        padding: "12px 16px",
                        fontFamily: "var(--font-sans)",
                        fontSize: "12px",
                        fontWeight: 600,
                        textAlign: "center",
                        borderBottom: "1px solid var(--lp-border)",
                        color: plan.tier === currentTier ? "var(--lp-purple)" : "var(--lp-text)",
                        background: plan.tier === currentTier ? "var(--lp-purple-dim)" : "transparent",
                        borderLeft: plan.tier === currentTier ? "2px solid var(--lp-purple)" : "none",
                      }}
                    >
                      <div>{plan.name}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 400, color: "var(--lp-muted)", marginTop: "2px" }}>{plan.price}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["Drafts", "Replies", "Contacts", "Products"].map((feat, fi) => (
                  <tr key={feat} style={{ borderBottom: "1px solid var(--lp-border)" }}>
                    <td style={{ padding: "10px 16px", fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--lp-muted)" }}>{feat}</td>
                    {PLAN_TABLE.map((plan) => (
                      <td
                        key={plan.tier}
                        style={{
                          padding: "10px 16px",
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                          textAlign: "center",
                          color: plan.tier === currentTier ? "var(--lp-text)" : "var(--lp-muted)",
                          background: plan.tier === currentTier ? "var(--lp-purple-dim)" : "transparent",
                          borderLeft: plan.tier === currentTier ? "2px solid var(--lp-purple)" : "none",
                        }}
                      >
                        {plan.features[fi]}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: "12px 16px" }} />
                  {PLAN_TABLE.map((plan) => (
                    <td
                      key={plan.tier}
                      style={{
                        padding: "12px 16px",
                        textAlign: "center",
                        background: plan.tier === currentTier ? "var(--lp-purple-dim)" : "transparent",
                        borderLeft: plan.tier === currentTier ? "2px solid var(--lp-purple)" : "none",
                      }}
                    >
                      {plan.tier !== currentTier && (
                        <form action={startCheckoutAction}>
                          <input type="hidden" name="tier" value={plan.tier} />
                          <button
                            type="submit"
                            disabled={!profile?.stripeConfigured}
                            style={{ fontFamily: "var(--font-sans)", fontSize: "11px", fontWeight: 500, color: "var(--lp-text)", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "5px", padding: "4px 10px", cursor: profile?.stripeConfigured ? "pointer" : "default", opacity: profile?.stripeConfigured ? 1 : 0.5 }}
                          >
                            Switch
                          </button>
                        </form>
                      )}
                      {plan.tier === currentTier && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-purple)" }}>current</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ borderLeft: "1px solid var(--lp-border)", background: "var(--lp-bg2)", overflowY: "auto" }}>
          {/* Payment method */}
          <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--lp-border)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>Payment method</div>
            <div style={{ background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "8px", padding: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--lp-text)" }}>Visa ···· 4242</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "3px", padding: "1px 5px" }}>VISA</span>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", marginBottom: "12px" }}>Expires 12/2028</div>
              <button
                type="button"
                style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--lp-purple-l, #A99DF9)", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
              >
                Update payment method
              </button>
            </div>
          </div>

          {/* Recent invoices */}
          <div style={{ padding: "20px 22px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>Recent invoices</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {RECENT_INVOICES.map((inv, i) => (
                <div
                  key={inv.date}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: i < RECENT_INVOICES.length - 1 ? "1px solid var(--lp-border)" : "none",
                  }}
                >
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--lp-text)" }}>{inv.amount}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", marginTop: "2px" }}>{inv.date}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-teal)", background: "rgba(45,212,160,0.10)", border: "1px solid rgba(45,212,160,0.2)", borderRadius: "4px", padding: "2px 6px" }}>paid</span>
                    <button type="button" style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", background: "transparent", border: "1px solid var(--lp-border)", borderRadius: "4px", padding: "2px 7px", cursor: "pointer" }}>PDF</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
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

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        profile: null,
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
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
