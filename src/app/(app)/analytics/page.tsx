import Link from "next/link";
import { BarChart3, Link2 } from "lucide-react";
import { AppTopbar, RangeTabs } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DashboardSummary, KeywordMovement } from "@/server/schemas/analytics";
import type { Product } from "@/server/schemas/product";
import { AnalyticsReadError, AnalyticsService, formatSourceLabel } from "@/server/services/analytics-service";
import { AuthRequiredError } from "@/server/services/auth-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

export default async function AnalyticsPage() {
  const data = await loadAnalyticsData();

  if (data.authRequired) {
    return <AnalyticsShell errorTitle="Sign in required" error="Sign in before viewing analytics." />;
  }

  if (data.error) {
    return <AnalyticsShell errorTitle="Analytics could not be loaded" error={data.error} destructive />;
  }

  if (!data.product || !data.summary) {
    return (
      <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <AppTopbar title="Analytics" />
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 40px" }}>
          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontStyle: "italic", color: "var(--lp-text)", marginBottom: "10px" }}>No product available</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-muted)" }}>Create a product during onboarding before analytics can be shown.</div>
          </div>
        </div>
      </main>
    );
  }

  const summary = data.summary;
  const hasAnalyticsData =
    summary.visitors > 0 ||
    summary.sourceBreakdown.length > 0 ||
    summary.keywordMovement.length > 0 ||
    summary.contentPerformance.length > 0;

  if (!hasAnalyticsData) {
    return (
      <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <AppTopbar
          title="Analytics"
          eyebrow={`Traffic and performance / ${data.product.name}`}
          actions={
            <Button size="sm" variant="outline" asChild>
              <Link href="/settings/connections">
                <Link2 />
                Connect analytics
              </Link>
            </Button>
          }
        />

        <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 40px", display: "grid", gap: "22px" }}>
          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", padding: "34px 24px", textAlign: "center" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "var(--lp-purple-dim)", border: "1px solid rgba(124,111,247,0.2)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "14px" }}>
              <BarChart3 style={{ width: "18px", height: "18px", color: "var(--lp-purple)" }} />
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "20px", color: "var(--lp-text)", marginBottom: "10px" }}>
              No analytics data yet
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-muted)", lineHeight: 1.7, maxWidth: "640px", margin: "0 auto 18px" }}>
              This product has no traffic snapshots or keyword rank snapshots yet. Once Plausible and rank ingestion are connected, this page will fill with visitors, source breakdowns, keyword movement, and content performance.
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
              <Button size="sm" asChild>
                <Link href="/settings/connections">
                  <Link2 />
                  Connect data sources
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/seo">
                  Review SEO opportunities
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Compute derived KPIs from real data
  const positions = summary.keywordMovement.map((k) => k.currentPosition).filter((p) => p > 0);
  const avgPosition = positions.length ? Math.round(positions.reduce((a, b) => a + b, 0) / positions.length) : null;
  const page1Count = summary.keywordMovement.filter((k) => k.currentPosition <= 10).length;

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <AppTopbar
        title="Analytics"
        eyebrow={`Traffic and performance / ${data.product.name}`}
      />
      <RangeTabs active="30d" />

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 40px", display: "flex", flexDirection: "column", gap: "22px" }}>
        {/* KPI Strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
          <KpiCard label="Total visitors" value={summary.visitors.toLocaleString()} delta={formatDelta(summary.visitorDeltaPercent)} />
          <KpiCard label="Avg position" value={avgPosition !== null ? `#${avgPosition}` : "—"} delta="across tracked keywords" neutral />
          <KpiCard label="Page 1 keywords" value={String(page1Count)} delta={`of ${summary.keywordMovement.length} tracked`} neutral />
          <KpiCard label="Published assets" value={String(summary.publishedAssets)} delta={summary.publishedAssetDelta >= 0 ? `+${summary.publishedAssetDelta} this period` : `${summary.publishedAssetDelta} this period`} neutral />
          <KpiCard label="Pending review" value={String(summary.pendingInboxItems)} delta={`~${summary.estimatedReviewMinutes} min`} neutral />
        </div>

        {/* Weekly Insight */}
        <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--lp-purple-dim)", border: "1px solid rgba(124,111,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: "14px", fontStyle: "italic", color: "var(--lp-purple)" }}>i</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "16px", fontStyle: "italic", color: "var(--lp-text)", marginBottom: "8px" }}>{summary.weeklyInsight.title}</div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-muted)", lineHeight: 1.7, margin: 0 }}>{summary.weeklyInsight.body}</p>
              {summary.weeklyInsight.actionLabel && (
                <div style={{ marginTop: "14px" }}>
                  <Link href="/inbox" style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, color: "#fff", background: "var(--lp-purple)", textDecoration: "none", borderRadius: "6px", padding: "6px 14px" }}>
                    {summary.weeklyInsight.actionLabel}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Traffic Sources Panel */}
        <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Traffic sources</div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)" }}>{summary.currentPeriod.label}</span>
          </div>
          {summary.sourceBreakdown.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--lp-border)" }}>
                  {["Source", "Share", "Visits", "%"].map((h) => (
                    <th key={h} style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 400, padding: "8px 16px", textAlign: h === "Visits" || h === "%" ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.sourceBreakdown.map((source) => (
                  <tr key={source.sourceType} style={{ borderBottom: "1px solid var(--lp-border)" }}>
                    <td style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 500, color: "var(--lp-text)", padding: "12px 16px" }}>{formatSourceLabel(source.sourceType)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ width: "120px", height: "6px", background: "var(--lp-bg4)", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${source.sharePercent}%`, background: "var(--lp-teal)", borderRadius: "3px" }} />
                      </div>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--lp-text)", padding: "12px 16px", textAlign: "right" }}>{source.visits.toLocaleString()}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--lp-muted)", padding: "12px 16px", textAlign: "right" }}>{source.sharePercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: "32px 18px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-muted)" }}>No traffic snapshots yet. Traffic source rows will appear after analytics are ingested.</div>
            </div>
          )}
        </div>

        {/* Keyword Positions Table */}
        <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Keyword positions</div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)" }}>{summary.keywordMovement.length} tracked</span>
          </div>
          {summary.keywordMovement.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--lp-border)" }}>
                  {["Keyword", "Position", "Change", "7d Trend", "Source"].map((h) => (
                    <th key={h} style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 400, padding: "8px 16px", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.keywordMovement.map((kw) => (
                  <tr key={kw.keyword} style={{ borderBottom: "1px solid var(--lp-border)" }}>
                    <td style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-text)", padding: "11px 16px" }}>{kw.keyword}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: positionColor(kw.currentPosition), padding: "11px 16px" }}>#{kw.currentPosition}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: changeColor(kw.trend), padding: "11px 16px" }}>
                      {kw.trend === "new" ? "new" : kw.change === null ? "—" : kw.change === 0 ? "flat" : `${kw.change > 0 ? "+" : ""}${kw.change}`}
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <TrendPill trend={kw.trend} />
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", padding: "11px 16px" }}>{kw.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: "32px 18px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-muted)" }}>No keyword rank snapshots yet.</div>
            </div>
          )}
        </div>

        {/* Content Performance Table */}
        {summary.contentPerformance.length > 0 && (
          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Content performance</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--lp-border)" }}>
                  {["Title", "Status", "Keyword rank", "Visits"].map((h) => (
                    <th key={h} style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 400, padding: "8px 16px", textAlign: h === "Visits" ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.contentPerformance.slice(0, 8).map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid var(--lp-border)" }}>
                    <td style={{ padding: "11px 16px" }}>
                      <Link href={`/content/${row.id}`} style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-text)", textDecoration: "none" }}>
                        {row.title}
                      </Link>
                      {row.targetKeyword && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", marginTop: "2px" }}>{row.targetKeyword}</div>
                      )}
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: row.status === "published" ? "var(--lp-teal)" : "var(--lp-muted)", background: row.status === "published" ? "rgba(45,212,160,0.10)" : "var(--lp-bg4)", border: `1px solid ${row.status === "published" ? "rgba(45,212,160,0.2)" : "var(--lp-border)"}`, borderRadius: "4px", padding: "2px 7px" }}>{row.status}</span>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: row.currentPosition ? positionColor(row.currentPosition) : "var(--lp-muted)", padding: "11px 16px" }}>
                      {row.currentPosition ? `#${row.currentPosition}` : "—"}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--lp-text)", padding: "11px 16px", textAlign: "right" }}>{row.visits.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function KpiCard({ label, value, delta, neutral }: { label: string; value: string; delta: string; neutral?: boolean }) {
  const deltaColor = neutral ? "var(--lp-muted)" : delta.startsWith("-") ? "var(--lp-red, #F06060)" : "var(--lp-teal)";
  return (
    <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", padding: "16px 18px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 400, color: "var(--lp-text)", lineHeight: 1, marginBottom: "8px" }}>{value}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: deltaColor }}>{delta}</div>
    </div>
  );
}

function TrendPill({ trend }: { trend: KeywordMovement["trend"] }) {
  const configs: Record<KeywordMovement["trend"], { label: string; color: string; bg: string; border: string }> = {
    up: { label: "↑ up", color: "var(--lp-teal)", bg: "rgba(45,212,160,0.10)", border: "rgba(45,212,160,0.2)" },
    down: { label: "↓ down", color: "var(--lp-red, #F06060)", bg: "rgba(240,96,96,0.12)", border: "rgba(240,96,96,0.25)" },
    flat: { label: "→ flat", color: "var(--lp-muted)", bg: "var(--lp-bg4)", border: "var(--lp-border)" },
    new: { label: "new", color: "var(--lp-amber)", bg: "rgba(240,164,41,0.12)", border: "rgba(240,164,41,0.25)" },
  };
  const c = configs[trend];
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: c.color, background: c.bg, border: `1px solid ${c.border}`, borderRadius: "4px", padding: "2px 6px" }}>{c.label}</span>
  );
}

function positionColor(pos: number): string {
  if (pos <= 10) return "var(--lp-teal)";
  if (pos <= 30) return "var(--lp-amber)";
  return "var(--lp-muted)";
}

function changeColor(trend: KeywordMovement["trend"]): string {
  if (trend === "up") return "var(--lp-teal)";
  if (trend === "down") return "var(--lp-red, #F06060)";
  return "var(--lp-muted)";
}

function AnalyticsShell({ errorTitle, error, destructive }: { errorTitle: string; error: string; destructive?: boolean }) {
  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <AppTopbar title="Analytics" />
      <div style={{ padding: "22px 28px" }}>
        <Alert variant={destructive ? "destructive" : "default"}>
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    </main>
  );
}

async function loadAnalyticsData(): Promise<{
  product: Product | null;
  summary: DashboardSummary | null;
  error: string | null;
  authRequired: boolean;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, summary: null, error: null, authRequired: false };
    }

    const summary = await new AnalyticsService(supabase).getDashboardSummary({ productId: product.id });
    return { product, summary, error: null, authRequired: false };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, summary: null, error: null, authRequired: true };
    }

    if (error instanceof ProductReadError || error instanceof AnalyticsReadError) {
      return { product: null, summary: null, error: error.message, authRequired: false };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        summary: null,
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
        authRequired: false,
      };
    }

    throw error;
  }
}

function formatDelta(value: number | null) {
  if (value === null) {
    return "no prior data";
  }

  return `${value >= 0 ? "+" : ""}${value}% vs prior period`;
}
