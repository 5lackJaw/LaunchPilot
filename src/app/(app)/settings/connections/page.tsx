import { AppTopbar } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requestConnectionSetupAction,
  revokeConnectionAction,
} from "@/app/(app)/settings/connections/actions";
import type { ExternalConnection } from "@/server/schemas/connections";
import { AuthRequiredError } from "@/server/services/auth-service";
import {
  ConnectionsReadError,
  ConnectionsService,
} from "@/server/services/connections-service";

type PageProps = {
  searchParams: Promise<{
    setupRequested?: string;
    revoked?: string;
    connectionError?: string;
  }>;
};

// Catalog of all possible connections, grouped by category
type CatalogEntry = {
  provider: ExternalConnection["provider"] | string;
  label: string;
  category: string;
  description: string;
};

const CONNECTION_CATALOG: CatalogEntry[] = [
  // Publishing
  { provider: "ghost", label: "Ghost CMS", category: "Publishing", description: "Publish SEO content directly to Ghost." },
  { provider: "wordpress", label: "WordPress", category: "Publishing", description: "Post to WordPress via REST API." },
  { provider: "webflow", label: "Webflow", category: "Publishing", description: "Push CMS items to Webflow collections." },
  { provider: "github", label: "GitHub", category: "Publishing", description: "Commit markdown to GitHub repositories." },
  // Analytics
  { provider: "google_search_console", label: "Google Search Console", category: "Analytics", description: "Pull keyword rankings and impressions." },
  { provider: "plausible", label: "Plausible Analytics", category: "Analytics", description: "Lightweight privacy-first traffic analytics." },
  { provider: "google_analytics_4", label: "Google Analytics 4", category: "Analytics", description: "GA4 event and conversion data." },
  // Social
  { provider: "reddit", label: "Reddit", category: "Social", description: "Monitor and reply to community threads." },
  { provider: "twitter", label: "X / Twitter", category: "Social", description: "Post and engage on X." },
  // Email
  { provider: "resend", label: "Resend", category: "Email", description: "Transactional and digest emails via Resend." },
  // Payments
  { provider: "stripe", label: "Stripe", category: "Payments", description: "Billing and subscription management." },
];

const CATEGORIES = ["Publishing", "Analytics", "Social", "Email", "Payments"];

export default async function ConnectionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadConnectionsData();
  const connectedCount = data.connections.filter((c) => c.status === "connected").length;

  // Build a lookup map from provider -> real connection data
  const connectionMap = new Map<string, ExternalConnection>();
  for (const conn of data.connections) {
    connectionMap.set(conn.provider, conn);
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <AppTopbar
        title="Settings"
        eyebrow="Connections"
        actions={
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "5px", padding: "3px 8px" }}>
            {connectedCount} connected
          </span>
        }
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 40px", display: "flex", flexDirection: "column", gap: "22px" }}>
        {params.setupRequested && (
          <Alert>
            <AlertTitle>Connection setup recorded</AlertTitle>
            <AlertDescription>The provider is marked pending until OAuth or encrypted credential capture is enabled.</AlertDescription>
          </Alert>
        )}
        {params.revoked && (
          <Alert>
            <AlertTitle>Connection revoked</AlertTitle>
            <AlertDescription>The stored connection record is disabled and credentials are cleared.</AlertDescription>
          </Alert>
        )}
        {(params.connectionError || data.error) && (
          <Alert variant="destructive">
            <AlertTitle>Connections could not be loaded</AlertTitle>
            <AlertDescription>{data.error ?? "Try again after confirming Supabase configuration."}</AlertDescription>
          </Alert>
        )}

        {CATEGORIES.map((category) => {
          const entries = CONNECTION_CATALOG.filter((e) => e.category === category);
          return (
            <div key={category}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>{category}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {entries.map((entry) => {
                  const live = connectionMap.get(entry.provider);
                  const isConnected = live?.status === "connected" || live?.source === "server_env";
                  const isPending = live?.status === "pending";
                  const isServerManaged = live?.source === "server_env";

                  return (
                    <div
                      key={entry.provider}
                      style={{
                        background: "var(--lp-bg3)",
                        border: "1px solid var(--lp-border)",
                        borderRadius: "10px",
                        padding: "18px",
                        opacity: isConnected ? 1 : 0.85,
                      }}
                    >
                      {/* Card header row */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
                        {/* Monogram icon */}
                        <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600, color: "var(--lp-muted2, #8A8A95)", textTransform: "uppercase" }}>
                            {entry.label.slice(0, 2)}
                          </span>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
                            <span style={{ fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 600, color: "var(--lp-text)" }}>{entry.label}</span>
                            {/* Status pill */}
                            <StatusPill status={isServerManaged ? "server" : isConnected ? "connected" : isPending ? "pending" : "disconnected"} />
                          </div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", lineHeight: 1.5 }}>{entry.description}</div>
                        </div>
                      </div>

                      {/* Action row */}
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        {isServerManaged ? (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "5px", padding: "4px 10px" }}>Server managed</span>
                        ) : isConnected ? (
                          <div style={{ display: "flex", gap: "6px" }}>
                            {live && (
                              <form action={revokeConnectionAction}>
                                <input type="hidden" name="provider" value={live.provider} />
                                <button type="submit" style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--lp-muted)", background: "transparent", border: "1px solid var(--lp-border)", borderRadius: "5px", padding: "4px 10px", cursor: "pointer" }}>
                                  Revoke
                                </button>
                              </form>
                            )}
                            <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--lp-teal)", background: "rgba(45,212,160,0.10)", border: "1px solid rgba(45,212,160,0.2)", borderRadius: "5px", padding: "4px 10px" }}>
                              Configure →
                            </span>
                          </div>
                        ) : isPending && live ? (
                          <form action={revokeConnectionAction}>
                            <input type="hidden" name="provider" value={live.provider} />
                            <button type="submit" style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--lp-muted)", background: "transparent", border: "1px solid var(--lp-border)", borderRadius: "5px", padding: "4px 10px", cursor: "pointer" }}>
                              Cancel setup
                            </button>
                          </form>
                        ) : (
                          <form action={requestConnectionSetupAction}>
                            <input type="hidden" name="provider" value={entry.provider} />
                            <button type="submit" style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, color: "#fff", background: "var(--lp-purple)", border: "none", borderRadius: "5px", padding: "5px 12px", cursor: "pointer" }}>
                              Connect
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function StatusPill({ status }: { status: "connected" | "pending" | "disconnected" | "server" }) {
  const configs: Record<typeof status, { label: string; color: string; bg: string; border: string }> = {
    connected: { label: "connected", color: "var(--lp-teal)", bg: "rgba(45,212,160,0.10)", border: "rgba(45,212,160,0.2)" },
    server: { label: "server env", color: "var(--lp-teal)", bg: "rgba(45,212,160,0.10)", border: "rgba(45,212,160,0.2)" },
    pending: { label: "pending", color: "var(--lp-amber)", bg: "rgba(240,164,41,0.12)", border: "rgba(240,164,41,0.25)" },
    disconnected: { label: "not connected", color: "var(--lp-muted)", bg: "var(--lp-bg4)", border: "var(--lp-border)" },
  };
  const c = configs[status];
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: c.color, background: c.bg, border: `1px solid ${c.border}`, borderRadius: "4px", padding: "2px 6px", flexShrink: 0 }}>{c.label}</span>
  );
}

async function loadConnectionsData(): Promise<{
  connections: ExternalConnection[];
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const connections = await new ConnectionsService(supabase).listConnections();
    return { connections, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { connections: [], error: error.message };
    }

    if (error instanceof ConnectionsReadError) {
      return { connections: [], error: error.message };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        connections: [],
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}
