import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DashboardSummary, KeywordMovement } from "@/server/schemas/analytics";
import type { MarketingBrief } from "@/server/schemas/brief";
import type { Product } from "@/server/schemas/product";
import { AnalyticsReadError, AnalyticsService, formatSourceLabel } from "@/server/services/analytics-service";
import { AuthRequiredError } from "@/server/services/auth-service";
import { BriefReadError, BriefService } from "@/server/services/brief-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

const clusterColors = ["#7C6FF7", "#2DD4A0", "#F0A429", "#5B9EF6", "#E879B8", "#A99DF9"];

export default async function KeywordsPage() {
  const data = await loadKeywordsData();

  if (data.authRequired) {
    return <KeywordsShell errorTitle="Sign in required" error="Sign in before viewing keyword tracking." />;
  }

  if (data.error) {
    return <KeywordsShell errorTitle="Keywords could not be loaded" error={data.error} destructive />;
  }

  if (!data.product || !data.summary) {
    return (
      <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--lp-bg)" }}>
        <AppTopbar title="Keywords" eyebrow="Insights" />
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 40px" }}>
          <EmptyPanel title="No product available" body="Create a product before keyword tracking can be shown." actionHref="/settings/products" actionLabel="Manage products" />
        </div>
      </main>
    );
  }

  const keywords = data.keywords;
  const hasKeywords = keywords.length > 0;
  const positions = keywords.map((keyword) => keyword.currentPosition);
  const avgPosition = positions.length ? Math.round(positions.reduce((sum, position) => sum + position, 0) / positions.length) : null;
  const page1Count = keywords.filter((keyword) => keyword.currentPosition <= 10).length;
  const risingCount = keywords.filter((keyword) => keyword.trend === "up").length;
  const fallingCount = keywords.filter((keyword) => keyword.trend === "down").length;
  const latestRecordedAt = getLatestRecordedAt(keywords);
  const clusters = buildClusterRows(keywords, data.brief);
  const movers = keywords
    .filter((keyword) => keyword.change !== null && keyword.change !== 0)
    .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0))
    .slice(0, 5);
  const buckets = buildPositionBuckets(keywords);

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--lp-bg)" }}>
      <AppTopbar
        title="Keywords"
        eyebrow={`Insights / ${data.product.name}`}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <GhostBtn disabled>Export CSV</GhostBtn>
            <SecBtn disabled>Refresh positions</SecBtn>
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 40px", display: "flex", flexDirection: "column", gap: "22px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
          {[
            { label: "Tracked keywords", value: String(keywords.length), delta: hasKeywords ? `${sourceLabel(keywords)} source data` : "no rank snapshots", deltaColor: hasKeywords ? "var(--lp-muted)" : "var(--lp-muted)" },
            { label: "Avg. position", value: avgPosition === null ? "-" : `#${avgPosition}`, delta: hasKeywords ? "across tracked keywords" : "waiting for ingestion", deltaColor: "var(--lp-muted)" },
            { label: "Page 1 keywords", value: String(page1Count), delta: `${page1Count} of ${keywords.length} tracked`, deltaColor: page1Count > 0 ? "#2DD4A0" : "var(--lp-muted)" },
            { label: "Rising keywords", value: String(risingCount), delta: fallingCount ? `${fallingCount} declining` : "no declining keywords", deltaColor: risingCount > 0 ? "#2DD4A0" : "var(--lp-muted)" },
            { label: "Last snapshot", value: latestRecordedAt ? formatShortDate(latestRecordedAt) : "-", delta: latestRecordedAt ? "latest rank record" : "not connected yet", deltaColor: "var(--lp-muted)" },
          ].map((kpi) => (
            <div key={kpi.label} style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", padding: "16px 18px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "9.5px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>{kpi.label}</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "28px", color: "var(--lp-text)", lineHeight: 1, marginBottom: "5px" }}>{kpi.value}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: kpi.deltaColor }}>{kpi.delta}</div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "14px", marginBottom: "12px" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "3px" }}>Position tracking</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 400, color: "var(--lp-text)" }}>All tracked keywords / latest SERP positions</div>
            </div>
          </div>

          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: 500, color: "var(--lp-text)" }}>
                Keywords
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", padding: "2px 7px", background: "var(--lp-bg4)", borderRadius: "4px", fontWeight: 400 }}>
                  {keywords.length} tracked
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <TabBtn active>All</TabBtn>
                <TabBtn>Page 1 <span style={{ opacity: 0.6 }}>/ {buckets.page1.count}</span></TabBtn>
                <TabBtn>Page 2 <span style={{ opacity: 0.6 }}>/ {buckets.page2.count}</span></TabBtn>
                <TabBtn>Page 3+ <span style={{ opacity: 0.6 }}>/ {buckets.page3Plus.count}</span></TabBtn>
              </div>
            </div>

            {hasKeywords ? (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {[
                      { label: "Keyword", align: "left", w: "32%" },
                      { label: "Position", align: "right", w: "10%" },
                      { label: "Change", align: "left", w: "10%" },
                      { label: "Volume", align: "right", w: "9%" },
                      { label: "Difficulty", align: "left", w: "9%" },
                      { label: "Intent", align: "left", w: "10%" },
                      { label: "Cluster", align: "left", w: "13%" },
                      { label: "Recorded", align: "left", w: "7%" },
                    ].map((h) => (
                      <th key={h.label} style={{
                        fontFamily: "var(--font-mono)", fontSize: "9.5px", fontWeight: 400,
                        textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--lp-muted)",
                        textAlign: h.align as "left" | "right", padding: "10px 18px",
                        borderBottom: "1px solid var(--lp-border)", background: "var(--lp-bg2)",
                        width: h.w,
                      }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw) => {
                    const cluster = findKeywordCluster(kw.keyword, data.brief);
                    return (
                      <tr key={`${kw.source}-${kw.keyword}`} style={{ borderBottom: "1px solid var(--lp-border)" }}>
                        <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "13px", color: "var(--lp-text)", fontWeight: 500 }}>{kw.keyword}</span>
                            <span style={{ fontSize: "11px", color: "var(--lp-muted)", fontFamily: "var(--font-mono)", maxWidth: "340px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {formatSourceLabel(kw.source)}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "12px 18px", textAlign: "right", verticalAlign: "middle" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 500, color: positionColor(kw.currentPosition) }}>#{kw.currentPosition}</span>
                        </td>
                        <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
                          <MovBadge keyword={kw} />
                        </td>
                        <td style={{ padding: "12px 18px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--lp-muted)", verticalAlign: "middle" }}>
                          -
                        </td>
                        <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
                          <UnavailablePill />
                        </td>
                        <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
                          <IntentPill value={inferIntent(kw.keyword)} />
                        </td>
                        <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
                          <ClusterPill cluster={cluster} />
                        </td>
                        <td style={{ padding: "12px 18px", verticalAlign: "middle", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted)" }}>
                          {formatShortDate(kw.recordedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: "40px 22px", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "18px", color: "var(--lp-text)", marginBottom: "8px" }}>No keyword rank snapshots yet</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-muted)", lineHeight: 1.6, maxWidth: "560px", margin: "0 auto 16px" }}>
                  Keyword opportunities from the Marketing Brief are available on SEO Content. This tracking page will populate after Search Console or rank snapshot ingestion records real positions.
                </div>
                <Link href="/seo" style={{ display: "inline-flex", alignItems: "center", height: "32px", padding: "0 14px", borderRadius: "7px", background: "var(--lp-purple)", color: "#fff", textDecoration: "none", fontFamily: "var(--font-sans)", fontSize: "12.5px", fontWeight: 500 }}>
                  Open SEO Content
                </Link>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
            <PanelHeader title="Position distribution" meta={`${keywords.length} kws`} />
            <div style={{ padding: "18px" }}>
              {Object.values(buckets).map((row) => (
                <DistributionRow key={row.label} row={row} total={Math.max(1, keywords.length)} />
              ))}
            </div>
            <PanelFooter>
              {hasKeywords ? (
                <>
                  <span style={{ color: "#2DD4A0", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{page1Count}</span> keywords are currently on page 1.
                </>
              ) : (
                "Position distribution will appear after keyword snapshots are ingested."
              )}
            </PanelFooter>
          </div>

          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
            <PanelHeader title="Cluster health" meta={`${clusters.length} clusters`} />
            <div>
              {clusters.length ? clusters.map((cluster, index) => (
                <div key={cluster.name} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 18px", borderBottom: index < clusters.length - 1 ? "1px solid var(--lp-border)" : "none" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: cluster.color, flexShrink: 0, display: "block" }} />
                  <span style={{ flex: 1, fontSize: "12.5px", fontWeight: 500, color: "var(--lp-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cluster.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted)", marginRight: "6px" }}>{cluster.count} kws</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 500, color: positionColor(cluster.avgPosition) }}>#{cluster.avgPosition}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: trendColor(cluster.trend), marginLeft: "6px" }}>{cluster.trend}</span>
                </div>
              )) : (
                <PanelEmpty>Cluster rows will appear when rank snapshots match Marketing Brief keywords.</PanelEmpty>
              )}
            </div>
          </div>

          <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
            <PanelHeader title="Biggest movers / latest" meta="top 5" />
            <div>
              {movers.length ? movers.map((mv, index) => (
                <div key={`${mv.source}-${mv.keyword}`} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 18px", borderBottom: "1px solid var(--lp-border)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: mv.trend === "up" ? "var(--lp-subtle)" : "#F06060", width: "18px", flexShrink: 0 }}>{index + 1}</span>
                  <span style={{ flex: 1, fontSize: "12.5px", color: "var(--lp-text)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {mv.keyword}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", flexShrink: 0 }}>
                    {mv.previousPosition ? `#${mv.previousPosition} -> #${mv.currentPosition}` : `#${mv.currentPosition}`}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 500, flexShrink: 0, padding: "2px 7px", borderRadius: "4px", color: trendColor(mv.trend), background: trendBackground(mv.trend) }}>
                    {formatRankChange(mv)}
                  </span>
                </div>
              )) : (
                <PanelEmpty>Movement rows require at least two snapshots for the same keyword.</PanelEmpty>
              )}
            </div>
            <PanelFooter>
              {hasKeywords ? `${keywords.length} tracked keywords are being read from stored rank snapshots.` : "No movement data available yet."}
            </PanelFooter>
          </div>
        </div>
      </div>
    </main>
  );
}

function KeywordsShell({ errorTitle, error, destructive }: { errorTitle: string; error: string; destructive?: boolean }) {
  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--lp-bg)" }}>
      <AppTopbar title="Keywords" eyebrow="Insights" />
      <div style={{ padding: "22px 28px" }}>
        <Alert variant={destructive ? "destructive" : "default"}>
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    </main>
  );
}

async function loadKeywordsData(): Promise<{
  product: Product | null;
  summary: DashboardSummary | null;
  brief: MarketingBrief | null;
  keywords: KeywordMovement[];
  error: string | null;
  authRequired: boolean;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, summary: null, brief: null, keywords: [], error: null, authRequired: false };
    }

    const analyticsService = new AnalyticsService(supabase);
    const [summary, keywords, brief] = await Promise.all([
      analyticsService.getDashboardSummary({ productId: product.id }),
      analyticsService.getKeywordTracking({ productId: product.id }),
      new BriefService(supabase).getCurrentBrief({ productId: product.id }),
    ]);

    return { product, summary, brief, keywords, error: null, authRequired: false };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, summary: null, brief: null, keywords: [], error: null, authRequired: true };
    }

    if (error instanceof ProductReadError || error instanceof AnalyticsReadError || error instanceof BriefReadError) {
      return { product: null, summary: null, brief: null, keywords: [], error: error.message, authRequired: false };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        summary: null,
        brief: null,
        keywords: [],
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
        authRequired: false,
      };
    }

    throw error;
  }
}

function MovBadge({ keyword }: { keyword: KeywordMovement }) {
  if (keyword.trend === "new") {
    return <span style={movementBadgeStyle("#A99DF9", "rgba(124,111,247,0.08)")}>new</span>;
  }

  if (!keyword.change) {
    return <span style={movementBadgeStyle("var(--lp-muted)", "transparent")}>flat</span>;
  }

  return (
    <span style={movementBadgeStyle(trendColor(keyword.trend), trendBackground(keyword.trend))}>
      {formatRankChange(keyword)}
    </span>
  );
}

function ClusterPill({ cluster }: { cluster: ClusterMatch | null }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted2)", padding: "2px 8px", borderRadius: "4px", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", maxWidth: "180px" }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "2px", background: cluster?.color ?? "var(--lp-muted)", flexShrink: 0, display: "block" }} />
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cluster?.name ?? "Unclustered"}</span>
    </span>
  );
}

function IntentPill({ value }: { value: string | null }) {
  return (
    <span style={{ display: "inline-block", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted2)", padding: "1px 7px", borderRadius: "4px", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)" }}>
      {value ?? "-"}
    </span>
  );
}

function UnavailablePill() {
  return (
    <span style={{ display: "inline-block", fontFamily: "var(--font-mono)", fontSize: "10.5px", padding: "2px 8px", borderRadius: "9999px", fontWeight: 500, border: "1px solid var(--lp-border)", color: "var(--lp-muted)", background: "var(--lp-bg4)" }}>
      -
    </span>
  );
}

function GhostBtn({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button disabled={disabled} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "0 14px", height: "32px", borderRadius: "7px", fontSize: "12.5px", fontWeight: 500, background: "transparent", color: disabled ? "var(--lp-muted)" : "var(--lp-muted2)", border: "1px solid var(--lp-border)", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)", opacity: disabled ? 0.7 : 1 }}>
      {children}
    </button>
  );
}

function SecBtn({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button disabled={disabled} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "0 14px", height: "32px", borderRadius: "7px", fontSize: "12.5px", fontWeight: 500, background: "var(--lp-bg3)", color: disabled ? "var(--lp-muted)" : "var(--lp-text)", border: "1px solid var(--lp-border)", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)", opacity: disabled ? 0.7 : 1 }}>
      {children}
    </button>
  );
}

function TabBtn({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <button style={{ padding: "5px 11px", fontFamily: "var(--font-mono)", fontSize: "11px", color: active ? "var(--lp-text)" : "var(--lp-muted)", border: `1px solid ${active ? "var(--lp-border2)" : "transparent"}`, borderRadius: "6px", background: active ? "var(--lp-bg4)" : "transparent", cursor: "default" }}>
      {children}
    </button>
  );
}

function EmptyPanel({ title, body, actionHref, actionLabel }: { title: string; body: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", padding: "40px 24px", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: "20px", color: "var(--lp-text)", marginBottom: "10px" }}>{title}</div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-muted)", marginBottom: actionHref ? "16px" : 0 }}>{body}</div>
      {actionHref && actionLabel ? (
        <Link href={actionHref} style={{ display: "inline-flex", alignItems: "center", height: "32px", padding: "0 14px", borderRadius: "7px", background: "var(--lp-purple)", color: "#fff", textDecoration: "none", fontFamily: "var(--font-sans)", fontSize: "12.5px", fontWeight: 500 }}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function PanelHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--lp-text)" }}>{title}</div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", padding: "2px 7px", background: "var(--lp-bg4)", borderRadius: "4px" }}>{meta}</span>
    </div>
  );
}

function PanelFooter({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "12px 18px", borderTop: "1px solid var(--lp-border)", fontSize: "12px", color: "var(--lp-muted)", lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function PanelEmpty({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "28px 18px", textAlign: "center", fontSize: "12.5px", color: "var(--lp-muted)", lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function DistributionRow({ row, total }: { row: PositionBucket; total: number }) {
  const pct = Math.round((row.count / total) * 100);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", width: "64px", flexShrink: 0, textAlign: "right" }}>{row.label}</div>
      <div style={{ flex: 1, height: "18px", background: "var(--lp-bg4)", borderRadius: "4px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: row.color, borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: row.count ? "0 6px" : 0 }}>
          {row.count ? <span style={{ fontFamily: "var(--font-mono)", fontSize: "9.5px", color: "#fff", fontWeight: 500 }}>{row.count}</span> : null}
        </div>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: row.count ? row.color : "var(--lp-muted)", width: "28px", flexShrink: 0 }}>{pct}%</div>
    </div>
  );
}

function sourceLabel(keywords: KeywordMovement[]) {
  const sources = new Set(keywords.map((keyword) => keyword.source));
  return sources.size === 1 ? formatSourceLabel(keywords[0]?.source ?? "rank") : `${sources.size} sources`;
}

function positionColor(pos: number): string {
  if (pos <= 10) return "#2DD4A0";
  if (pos <= 30) return "#F0A429";
  return "var(--lp-muted)";
}

function trendColor(trend: KeywordMovement["trend"]): string {
  if (trend === "up") return "#2DD4A0";
  if (trend === "down") return "#F06060";
  if (trend === "new") return "#A99DF9";
  return "var(--lp-muted)";
}

function trendBackground(trend: KeywordMovement["trend"]) {
  if (trend === "up") return "rgba(45,212,160,0.10)";
  if (trend === "down") return "rgba(240,96,96,0.12)";
  if (trend === "new") return "rgba(124,111,247,0.08)";
  return "var(--lp-bg4)";
}

function movementBadgeStyle(color: string, background: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    padding: "2px 7px",
    borderRadius: "4px",
    color,
    background,
  };
}

function formatRankChange(keyword: KeywordMovement) {
  if (keyword.trend === "new") return "new";
  if (keyword.change === null || keyword.change === 0) return "flat";
  return `${keyword.change > 0 ? "+" : ""}${keyword.change}`;
}

function getLatestRecordedAt(keywords: KeywordMovement[]) {
  return keywords
    .map((keyword) => keyword.recordedAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase();
}

function inferIntent(keyword: string) {
  const normalized = normalizeKeyword(keyword);

  if (/\b(pricing|login|review|reviews|features|docs)\b/.test(normalized)) {
    return "navigational";
  }

  if (/\b(best|software|tool|platform|buy|pricing|alternative|vs)\b/.test(normalized)) {
    return "commercial";
  }

  return "informational";
}

type ClusterMatch = {
  name: string;
  color: string;
};

function findKeywordCluster(keyword: string, brief: MarketingBrief | null): ClusterMatch | null {
  if (!brief) return null;
  const normalized = normalizeKeyword(keyword);

  for (let index = 0; index < brief.keywordClusters.length; index += 1) {
    const cluster = brief.keywordClusters[index];

    if (cluster.keywords.some((clusterKeyword: string) => normalizeKeyword(clusterKeyword) === normalized)) {
      return {
        name: cluster.name,
        color: clusterColors[index % clusterColors.length],
      };
    }
  }

  return null;
}

type ClusterRow = {
  name: string;
  color: string;
  count: number;
  avgPosition: number;
  trend: "up" | "down" | "flat" | "new";
};

function buildClusterRows(keywords: KeywordMovement[], brief: MarketingBrief | null): ClusterRow[] {
  const rows = new Map<string, { color: string; positions: number[]; trends: KeywordMovement["trend"][] }>();

  keywords.forEach((keyword) => {
    const cluster = findKeywordCluster(keyword.keyword, brief);
    if (!cluster) return;

    const row = rows.get(cluster.name) ?? { color: cluster.color, positions: [], trends: [] };
    row.positions.push(keyword.currentPosition);
    row.trends.push(keyword.trend);
    rows.set(cluster.name, row);
  });

  return Array.from(rows.entries()).map(([name, row]) => ({
    name,
    color: row.color,
    count: row.positions.length,
    avgPosition: Math.round(row.positions.reduce((sum, position) => sum + position, 0) / Math.max(1, row.positions.length)),
    trend: dominantTrend(row.trends),
  }));
}

function dominantTrend(trends: KeywordMovement["trend"][]): KeywordMovement["trend"] {
  const counts = trends.reduce<Record<KeywordMovement["trend"], number>>(
    (acc, trend) => ({ ...acc, [trend]: acc[trend] + 1 }),
    { up: 0, down: 0, flat: 0, new: 0 },
  );

  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "flat") as KeywordMovement["trend"];
}

type PositionBucket = {
  label: string;
  count: number;
  color: string;
};

function buildPositionBuckets(keywords: KeywordMovement[]) {
  return {
    page1: { label: "Page 1", count: keywords.filter((keyword) => keyword.currentPosition <= 10).length, color: "#2DD4A0" },
    page2: { label: "Page 2", count: keywords.filter((keyword) => keyword.currentPosition > 10 && keyword.currentPosition <= 20).length, color: "#F0A429" },
    page3Plus: { label: "Page 3+", count: keywords.filter((keyword) => keyword.currentPosition > 20).length, color: "var(--lp-muted)" },
    unranked: { label: "Unranked", count: 0, color: "var(--lp-subtle)" },
  } satisfies Record<string, PositionBucket>;
}
