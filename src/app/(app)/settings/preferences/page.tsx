import { AppTopbar } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateAutomationPreferenceAction } from "@/app/(app)/settings/preferences/actions";
import type { AutomationPreference } from "@/server/schemas/preferences";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { PreferencesReadError, PreferencesService } from "@/server/services/preferences-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{
    updated?: string;
    preferenceError?: string;
  }>;
};

export default async function PreferencesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadPreferencesData();

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <AppTopbar
        title="Settings"
        eyebrow={data.product ? `Preferences / ${data.product.name}` : "Preferences"}
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 40px", display: "flex", flexDirection: "column", gap: "22px" }}>
        {params.updated && (
          <Alert>
            <AlertTitle>Preference saved</AlertTitle>
            <AlertDescription>The {params.updated} automation setting is now active for this product.</AlertDescription>
          </Alert>
        )}
        {(params.preferenceError || data.error) && (
          <Alert variant="destructive">
            <AlertTitle>Preferences could not be loaded</AlertTitle>
            <AlertDescription>{data.error ?? params.preferenceError}</AlertDescription>
          </Alert>
        )}

        {/* TRUST LEVELS */}
        <SectionBlock label="Trust levels">
          {[
            { channel: "SEO content auto-publish", selected: "L1", description: "L1: drafts require one-click approval before publishing." },
            { channel: "Community replies", selected: "L1", description: "L1: replies go to inbox for review before posting." },
            { channel: "Outreach emails", selected: "Off", description: "Off: no automated outreach emails are sent." },
          ].map((row) => (
            <TrustLevelRow key={row.channel} label={row.channel} selected={row.selected} description={row.description} />
          ))}
          {/* If real preferences exist, show them too */}
          {data.product && data.preferences.length > 0 && (
            <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid var(--lp-border)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", marginBottom: "12px" }}>Live automation preferences</div>
              {data.preferences.map((pref) => (
                <form key={pref.channel} action={updateAutomationPreferenceAction} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <input type="hidden" name="productId" value={data.product!.id} />
                  <input type="hidden" name="channel" value={pref.channel} />
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-text)", textTransform: "capitalize" }}>{pref.channel}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "4px", padding: "2px 8px" }}>Level {pref.trustLevel}</span>
                </form>
              ))}
            </div>
          )}
        </SectionBlock>

        {/* REVIEW WINDOW */}
        <SectionBlock label="Review window">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-text)", fontWeight: 500, marginBottom: "4px" }}>Auto-approval delay</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted)" }}>Items not reviewed within this window auto-approve if trust level allows.</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "24px", fontWeight: 600, color: "var(--lp-text)" }}>72</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)" }}>hours</span>
              </div>
              <div style={{ display: "flex", gap: "2px", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "7px", padding: "3px" }}>
                {["24h", "48h", "72h", "168h"].map((opt) => (
                  <span
                    key={opt}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      padding: "3px 8px",
                      borderRadius: "5px",
                      cursor: "pointer",
                      color: opt === "72h" ? "var(--lp-text)" : "var(--lp-muted)",
                      background: opt === "72h" ? "var(--lp-bg3)" : "transparent",
                      border: opt === "72h" ? "1px solid var(--lp-border)" : "1px solid transparent",
                    }}
                  >
                    {opt}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </SectionBlock>

        {/* NOTIFICATIONS */}
        <SectionBlock label="Notifications">
          <ToggleRow label="Weekly digest email" description="Receive a weekly summary of SEO and content performance." on={true} />
          <ToggleRow label="Inbox item notifications" description="Get notified when new items land in the approval inbox." on={false} />
          <ToggleRow label="Rank movement alerts" description="Alert when tracked keywords move significantly in position." on={true} />
          <ToggleRow label="New opportunity alerts" description="Notify when new SEO or community opportunities are found." on={true} />
        </SectionBlock>

        {/* CONTENT PREFERENCES */}
        <SectionBlock label="Content preferences">
          {/* Article length segmented selector */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-text)", fontWeight: 500, marginBottom: "4px" }}>Default article length</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted)" }}>Target word count for generated long-form articles.</div>
            </div>
            <div style={{ display: "flex", gap: "2px", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "7px", padding: "3px" }}>
              {["1200", "1500", "1800", "2400"].map((len) => (
                <span
                  key={len}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    padding: "4px 9px",
                    borderRadius: "5px",
                    cursor: "pointer",
                    color: len === "1800" ? "var(--lp-text)" : "var(--lp-muted)",
                    background: len === "1800" ? "var(--lp-bg3)" : "transparent",
                    border: len === "1800" ? "1px solid var(--lp-border)" : "1px solid transparent",
                  }}
                >
                  {len}
                </span>
              ))}
            </div>
          </div>

          <ToggleRow label="Generate comparison pages" description="Automatically create vs-competitor comparison content." on={true} />
          <ToggleRow label="Internal linking" description="Inject internal links into generated content where relevant." on={true} />
          <ToggleRow label="Schema markup" description="Add structured data JSON-LD to published content." on={true} />
        </SectionBlock>
      </div>
    </main>
  );
}

function SectionBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px" }}>
      <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", borderRadius: "10px 10px 0 0" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      </div>
      <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {children}
      </div>
    </div>
  );
}

function ToggleRow({ label, description, on }: { label: string; description: string; on: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-text)", fontWeight: 500, marginBottom: "2px" }}>{label}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted)" }}>{description}</div>
      </div>
      <div style={{ width: "30px", height: "16px", background: on ? "var(--lp-purple)" : "var(--lp-border2)", borderRadius: "9999px", position: "relative", flexShrink: 0 }}>
        <span style={{ position: "absolute", left: on ? "auto" : "2px", right: on ? "2px" : "auto", top: "2px", width: "12px", height: "12px", background: on ? "#fff" : "var(--lp-muted)", borderRadius: "50%", display: "block" }} />
      </div>
    </div>
  );
}

function TrustLevelRow({ label, selected, description }: { label: string; selected: string; description: string }) {
  const options = ["Off", "L1", "L2"];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-text)", fontWeight: 500, marginBottom: "2px" }}>{label}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted)" }}>{description}</div>
      </div>
      <div style={{ display: "flex", gap: "2px", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "7px", padding: "3px", flexShrink: 0 }}>
        {options.map((opt) => (
          <span
            key={opt}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              padding: "3px 8px",
              borderRadius: "5px",
              cursor: "pointer",
              color: opt === selected ? "var(--lp-text)" : "var(--lp-muted)",
              background: opt === selected ? "var(--lp-bg3)" : "transparent",
              border: opt === selected ? "1px solid var(--lp-border)" : "1px solid transparent",
            }}
          >
            {opt}
          </span>
        ))}
      </div>
    </div>
  );
}

async function loadPreferencesData(): Promise<{
  product: Product | null;
  preferences: AutomationPreference[];
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, preferences: [], error: null };
    }

    const preferences = await new PreferencesService(supabase).listAutomationPreferences({ productId: product.id });
    return { product, preferences, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, preferences: [], error: error.message };
    }

    if (error instanceof ProductReadError || error instanceof PreferencesReadError) {
      return { product: null, preferences: [], error: error.message };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        preferences: [],
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}
