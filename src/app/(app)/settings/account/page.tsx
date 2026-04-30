import { AppTopbar } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteAccountAction } from "@/app/(app)/settings/account/actions";
import { AccountService, accountErrorMessage, type AccountOverview } from "@/server/services/account-service";

type PageProps = {
  searchParams: Promise<{
    deleteError?: string;
  }>;
};

const CONNECTED_SERVICES = [
  { id: "ghost", label: "Ghost CMS", monogram: "GH" },
  { id: "gsc", label: "Google Search Console", monogram: "SC" },
  { id: "plausible", label: "Plausible Analytics", monogram: "PL" },
  { id: "reddit", label: "Reddit", monogram: "RD" },
];

export default async function AccountSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadAccountData();

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <AppTopbar title="Account data" eyebrow="Privacy & data management" />

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 40px" }}>
        <div style={{ maxWidth: "640px", display: "flex", flexDirection: "column", gap: "22px" }}>
          {(params.deleteError || data.error) && (
            <Alert variant="destructive">
              <AlertTitle>Account settings could not be completed</AlertTitle>
              <AlertDescription>{data.error ?? params.deleteError}</AlertDescription>
            </Alert>
          )}

          {/* ACCOUNT INFO */}
          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Account info</div>
            </div>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <AccountInfoRow label="Email" value={data.overview?.user.email ?? "ckarling@gmail.com"} />
              <AccountInfoRow label="Account created" value={data.overview?.user.createdAt ? formatDate(data.overview.user.createdAt) : "March 28, 2026"} />
              <AccountInfoRow label="Products" value={String(data.overview?.productCount ?? 1)} />
            </div>
          </div>

          {/* DATA EXPORT */}
          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Data export</div>
            </div>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-muted)", lineHeight: 1.7, margin: 0 }}>
                Download a JSON snapshot of all account-owned LaunchBeacon records including products, content, keywords, analytics, and settings. Credentials are never included.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <a
                  href="/settings/account/export"
                  style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, color: "var(--lp-text)", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "6px", padding: "7px 14px", textDecoration: "none", display: "inline-block" }}
                >
                  Export all data
                </a>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)" }}>Last export: Never</span>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted)", lineHeight: 1.6 }}>
                Processing takes up to 24 hours. You&apos;ll receive an email when ready.
              </div>
            </div>
          </div>

          {/* CONNECTED ACCOUNTS */}
          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Connected accounts</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {CONNECTED_SERVICES.map((svc, i) => (
                <div
                  key={svc.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 18px",
                    borderBottom: i < CONNECTED_SERVICES.length - 1 ? "1px solid var(--lp-border)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "7px", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 600, color: "var(--lp-muted2, #8A8A95)", textTransform: "uppercase" }}>{svc.monogram}</span>
                    </div>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-text)" }}>{svc.label}</span>
                  </div>
                  <button
                    type="button"
                    style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--lp-red, #F06060)", background: "transparent", border: "1px solid rgba(240,96,96,0.3)", borderRadius: "5px", padding: "4px 10px", cursor: "pointer" }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* DATA DELETION */}
          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Data deletion</div>
            </div>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Warning box */}
              <div style={{ background: "rgba(240,96,96,0.08)", border: "1px solid rgba(240,96,96,0.2)", borderLeft: "3px solid var(--lp-red, #F06060)", borderRadius: "6px", padding: "12px 14px" }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 600, color: "var(--lp-red, #F06060)", marginBottom: "6px" }}>Permanent action</div>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--lp-muted)", lineHeight: 1.6, margin: 0 }}>
                  This permanently deletes your Supabase auth account and all associated LaunchBeacon data including products, briefs, content, analytics, connections, and settings. This cannot be undone.
                </p>
              </div>

              <form action={deleteAccountAction} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Type DELETE to confirm
                  </label>
                  <input
                    name="confirmation"
                    autoComplete="off"
                    style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--lp-text)", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "6px", padding: "8px 12px", outline: "none", width: "100%", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 500, color: "#fff", background: "var(--lp-red, #F06060)", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer" }}
                  >
                    Request data deletion
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function AccountInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--lp-text)" }}>{value}</span>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(value));
}

async function loadAccountData(): Promise<{
  overview: AccountOverview | null;
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const overview = await new AccountService(supabase).getOverview();
    return { overview, error: null };
  } catch (error) {
    const message = accountErrorMessage(error);
    if (message) {
      return { overview: null, error: message };
    }

    throw error;
  }
}
