import { Fragment } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Search } from "lucide-react";
import { AppTopbar } from "@/components/layout/app-topbar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { selectKeywordOpportunityAction } from "@/app/(app)/seo/actions";
import type { ContentAsset, KeywordOpportunity } from "@/server/schemas/content";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { ContentAssetReadError, ContentService } from "@/server/services/content-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{ selected?: string; selectionError?: string }>;
};

export default async function SeoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadSeoData();

  if (data.authRequired) {
    return (
      <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <AppTopbar title="SEO Content" eyebrow="Channel" />
        <div style={{ padding: "24px" }}>
          <EmptyState icon={Search} title="Sign in required" description="Sign in before viewing SEO content." />
        </div>
      </main>
    );
  }

  if (data.error) {
    return (
      <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <AppTopbar title="SEO Content" eyebrow="Channel" />
        <div style={{ padding: "24px" }}>
          <Alert variant="destructive">
            <AlertTitle>SEO content could not be loaded</AlertTitle>
            <AlertDescription>{data.error}</AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

  const { product, opportunities, recentAssets } = data;

  const clusterMap = new Map<string, KeywordOpportunity[]>();
  for (const opp of opportunities) {
    const cluster = opp.clusterName ?? "Unclustered";
    if (!clusterMap.has(cluster)) clusterMap.set(cluster, []);
    clusterMap.get(cluster)!.push(opp);
  }
  const clusters = Array.from(clusterMap.entries()).sort((a, b) => b[1].length - a[1].length);
  const firstCluster = clusters[0]?.[0] ?? "—";
  const firstClusterOpps = clusters[0]?.[1] ?? [];

  function getOppStatus(opp: KeywordOpportunity): "untracked" | "queued" | "drafted" | "published" {
    const match = recentAssets.find((a) => a.targetKeyword === opp.targetKeyword);
    if (!match) return "untracked";
    if (match.status === "published") return "published";
    if (match.status === "approved") return "queued";
    return "drafted";
  }

  const publishedAssets = recentAssets.filter((a) => a.status === "published");
  const contentRows = publishedAssets.length > 0 ? publishedAssets : recentAssets.slice(0, 8);

  const clusterColors = ["var(--lp-purple)", "var(--lp-teal)", "var(--lp-amber)", "#7AB5FA", "#E879B8"];

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--lp-bg)" }}>

      <AppTopbar
        title="SEO Content"
        eyebrow="Channel · Ghost CMS connected"
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <GhostBtn>↓ Export keywords</GhostBtn>
            <SecBtn>⟳ Refresh research</SecBtn>
            <PriBtn>+ Generate article</PriBtn>
          </div>
        }
      />

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 320px", overflow: "hidden" }}>

        {/* ── MAIN COLUMN ── */}
        <div style={{ overflowY: "auto", padding: "22px 28px 40px", display: "flex", flexDirection: "column", gap: "22px" }}>

          {params.selected && (
            <Alert>
              <AlertTitle>Content draft queued</AlertTitle>
              <AlertDescription>The selected keyword now has a durable content asset placeholder for the generation workflow.</AlertDescription>
            </Alert>
          )}
          {params.selectionError && (
            <Alert variant="destructive">
              <AlertTitle>Selection failed</AlertTitle>
              <AlertDescription>{params.selectionError}</AlertDescription>
            </Alert>
          )}

          {!product ? (
            <EmptyState icon={Search} title="No product available" description="Create a product during onboarding before planning SEO content." />
          ) : (
            <>
              {/* Insight callout */}
              <div style={{
                background: "var(--lp-bg3)", border: "1px solid var(--lp-border)",
                borderLeft: "3px solid var(--lp-purple)", borderRadius: "0 10px 10px 0",
                padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: "14px"
              }}>
                <span style={{ fontSize: "16px", color: "var(--lp-purple-l)", flexShrink: 0, marginTop: "2px" }}>⚡</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                    This week&apos;s recommendation
                  </div>
                  <div style={{ fontSize: "13.5px", color: "var(--lp-text)", lineHeight: 1.65 }}>
                    {opportunities.length > 0 ? (
                      <>
                        You have{" "}
                        <strong style={{ color: "var(--lp-purple-l)", fontWeight: 500 }}>{opportunities.length} keyword opportunities</strong>{" "}
                        across {clusters.length} cluster{clusters.length !== 1 ? "s" : ""}. Focus on your highest-priority untracked keywords to build topical authority before competitors do.
                      </>
                    ) : (
                      <>No keyword opportunities yet. Complete the Marketing Brief to surface content seeds from your product positioning.</>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "10px", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--lp-muted)" }}>
                    <span>Based on your current keyword research</span>
                    <span>·</span>
                    <span>{recentAssets.length} content assets tracked</span>
                  </div>
                </div>
              </div>

              {/* Opportunities */}
              <div>
                <SectionHeader eyebrow="Opportunities" title="Keywords ranked by realistic ranking probability" />
                <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
                  <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: 500, color: "var(--lp-text)" }}>
                      ◈ Keyword opportunities
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", padding: "2px 7px", background: "var(--lp-bg4)", borderRadius: "4px", fontWeight: 400 }}>
                        {opportunities.length} tracked
                      </span>
                    </div>
                  </div>

                  {opportunities.length === 0 ? (
                    <div style={{ padding: "40px 18px", textAlign: "center", color: "var(--lp-muted)", fontFamily: "var(--font-mono)", fontSize: "13px" }}>
                      No keyword opportunities yet — complete the Marketing Brief first.
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {(["Keyword", "Priority", "Difficulty", "Type", "Status", "Action"] as const).map((h, i) => (
                            <th key={h} style={{
                              fontFamily: "var(--font-mono)", fontSize: "9.5px", fontWeight: 400,
                              textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--lp-muted)",
                              textAlign: i >= 4 ? "right" : i === 2 ? "center" : "left",
                              padding: "10px 18px", borderBottom: "1px solid var(--lp-border)", background: "var(--lp-bg2)"
                            }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {opportunities.map((opp) => {
                          const status = getOppStatus(opp);
                          const kd = opp.priorityScore >= 70 ? "low" : opp.priorityScore >= 40 ? "mid" : "high";
                          const kdLabel = kd === "low" ? "Low" : kd === "mid" ? "Med" : "High";
                          const kdColor = kd === "low" ? "#2DD4A0" : kd === "mid" ? "#F0A429" : "#F06060";
                          const kdBg = kd === "low" ? "rgba(45,212,160,0.10)" : kd === "mid" ? "rgba(240,164,41,0.12)" : "rgba(240,96,96,0.12)";
                          const kdBorder = kd === "low" ? "rgba(45,212,160,0.25)" : kd === "mid" ? "rgba(240,164,41,0.25)" : "rgba(240,96,96,0.25)";
                          return (
                            <tr key={opp.id} style={{ borderBottom: "1px solid var(--lp-border)", cursor: "pointer" }}>
                              <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                  <span style={{ fontSize: "13px", color: "var(--lp-text)", fontWeight: 500 }}>{opp.targetKeyword ?? opp.title}</span>
                                  {opp.clusterName && (
                                    <span style={{ fontSize: "11px", color: "var(--lp-muted)", fontFamily: "var(--font-mono)" }}>cluster · {opp.clusterName}</span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: "12px 18px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--lp-text)", verticalAlign: "middle" }}>
                                {opp.priorityScore}
                              </td>
                              <td style={{ padding: "12px 18px", textAlign: "center", verticalAlign: "middle" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", fontFamily: "var(--font-mono)", fontSize: "10.5px", padding: "2px 8px", borderRadius: "9999px", fontWeight: 500, border: `1px solid ${kdBorder}`, color: kdColor, background: kdBg }}>
                                  {kdLabel}
                                </span>
                              </td>
                              <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
                                <span style={{ display: "inline-block", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted2)", padding: "1px 7px", borderRadius: "4px", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)" }}>
                                  {opp.type}
                                </span>
                              </td>
                              <td style={{ padding: "12px 18px", textAlign: "right", verticalAlign: "middle" }}>
                                <OppStatus status={status} />
                              </td>
                              <td style={{ padding: "12px 18px", textAlign: "right", verticalAlign: "middle" }}>
                                {status === "untracked" ? (
                                  <form action={selectKeywordOpportunityAction} style={{ display: "inline" }}>
                                    <input type="hidden" name="productId" value={opp.productId} />
                                    <input type="hidden" name="opportunityId" value={opp.id} />
                                    <button type="submit" style={{ padding: "4px 10px", borderRadius: "5px", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-purple-l)", background: "var(--lp-purple-dim)", border: "1px solid rgba(124,111,247,0.2)", cursor: "pointer" }}>
                                      + Draft
                                    </button>
                                  </form>
                                ) : (
                                  <button style={{ padding: "4px 10px", borderRadius: "5px", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted2)", background: "transparent", border: "1px solid var(--lp-border)", cursor: "pointer" }}>
                                    {status === "published" ? "View article" : status === "drafted" ? "Open in inbox" : "Move up"}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Calendar */}
              <div>
                <SectionHeader eyebrow="Schedule" title="Content calendar" />
                <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
                  <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: 500, color: "var(--lp-text)" }}>
                      ⊞ Content schedule
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <TabBtn active>Weekly</TabBtn>
                      <TabBtn>Monthly</TabBtn>
                    </div>
                  </div>
                  <CalendarGrid assets={recentAssets} />
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "10px 18px", background: "var(--lp-bg2)", borderTop: "1px solid var(--lp-border)", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted)" }}>
                    {[
                      { color: "#2DD4A0", label: "Published" },
                      { color: "#F0A429", label: "Drafted · awaiting approval" },
                      { color: "#7C6FF7", label: "Queued · auto-generates on schedule" },
                    ].map(({ color, label }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: color, display: "block", flexShrink: 0 }} />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Performance */}
              <div>
                <SectionHeader eyebrow="Performance" title="Published articles · ranking and traffic" />
                <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Article", "Status", "Keyword", "Updated"].map((h) => (
                          <th key={h} style={{
                            fontFamily: "var(--font-mono)", fontSize: "9.5px", fontWeight: 400,
                            textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--lp-muted)",
                            textAlign: "left", padding: "10px 18px", borderBottom: "1px solid var(--lp-border)", background: "var(--lp-bg2)"
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {contentRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: "32px 18px", textAlign: "center", color: "var(--lp-muted)", fontSize: "13px", fontFamily: "var(--font-mono)" }}>
                            No content assets yet
                          </td>
                        </tr>
                      ) : (
                        contentRows.slice(0, 8).map((asset) => (
                          <tr key={asset.id} style={{ borderBottom: "1px solid var(--lp-border)", cursor: "pointer" }}>
                            <td style={{ padding: "12px 18px" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "3px", maxWidth: "360px" }}>
                                <span style={{ fontSize: "13px", color: "var(--lp-text)", fontWeight: 500, lineHeight: 1.4 }}>{asset.title}</span>
                                <span style={{ fontSize: "11px", color: "var(--lp-muted)", fontFamily: "var(--font-mono)" }}>{asset.type}</span>
                              </div>
                            </td>
                            <td style={{ padding: "12px 18px" }}>
                              <AssetStatus status={asset.status} />
                            </td>
                            <td style={{ padding: "12px 18px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)" }}>
                              {asset.targetKeyword ?? "—"}
                            </td>
                            <td style={{ padding: "12px 18px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)" }}>
                              {asset.updatedAt
                                ? new Date(asset.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── SIDE COLUMN ── */}
        <div style={{ borderLeft: "1px solid var(--lp-border)", background: "var(--lp-bg2)", overflowY: "auto" }}>

          {clusters.length > 0 && (
            <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--lp-border)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
                Selected · cluster
              </div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 400, color: "var(--lp-text)", letterSpacing: "-0.01em", lineHeight: 1.3, marginBottom: "4px" }}>
                {firstCluster}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", marginBottom: "16px" }}>
                {firstClusterOpps.length} keywords tracked
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--lp-border)", border: "1px solid var(--lp-border)", borderRadius: "8px", overflow: "hidden", marginBottom: "14px" }}>
                {[
                  { label: "Opportunities", value: String(firstClusterOpps.length) },
                  {
                    label: "Avg priority",
                    value: firstClusterOpps.length
                      ? String(Math.round(firstClusterOpps.reduce((s, o) => s + o.priorityScore, 0) / firstClusterOpps.length))
                      : "—"
                  },
                  { label: "Drafted", value: String(firstClusterOpps.filter((o) => getOppStatus(o) === "drafted").length) },
                  { label: "Published", value: String(firstClusterOpps.filter((o) => getOppStatus(o) === "published").length) },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: "var(--lp-bg3)", padding: "12px 14px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "9.5px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                      {stat.label}
                    </div>
                    <div style={{ fontFamily: "var(--font-serif)", fontSize: "22px", fontWeight: 400, color: "var(--lp-text)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {clusters.length > 0 && (
            <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--lp-border)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                All clusters
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {clusters.map(([name, opps], i) => (
                  <div key={name} style={{
                    display: "flex", alignItems: "center", gap: "10px", padding: "9px 11px",
                    background: i === 0 ? "var(--lp-purple-dim)" : "var(--lp-bg3)",
                    border: `1px solid ${i === 0 ? "var(--lp-purple)" : "var(--lp-border)"}`,
                    borderRadius: "7px", cursor: "pointer"
                  }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: clusterColors[i % clusterColors.length], flexShrink: 0, display: "block" }} />
                    <span style={{ flex: 1, fontSize: "12.5px", color: "var(--lp-text)", fontWeight: 500 }}>{name}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted)" }}>{opps.length}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {product && (
            <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--lp-border)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                Next action
              </div>
              <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "9px", padding: "14px 16px" }}>
                <div style={{ fontSize: "13px", color: "var(--lp-text)", lineHeight: 1.6, marginBottom: "12px" }}>
                  <strong style={{ color: "var(--lp-purple-l)", fontWeight: 500 }}>
                    {opportunities.filter((o) => getOppStatus(o) === "untracked").length} untracked keywords
                  </strong>{" "}
                  could be drafted now — starting with your highest priority cluster.
                </div>
                {opportunities.find((o) => getOppStatus(o) === "untracked") && (
                  <form action={selectKeywordOpportunityAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="opportunityId" value={opportunities.find((o) => getOppStatus(o) === "untracked")!.id} />
                    <button type="submit" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "7px", background: "var(--lp-purple)", color: "#fff", fontSize: "12.5px", fontWeight: 500, border: "none", cursor: "pointer" }}>
                      + Draft top keyword
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          <div style={{ padding: "20px 22px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
              SEO settings
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {([
                { label: "Auto-publish drafts", on: false },
                { label: "Generate comparison pages", on: true },
                { label: "Internal linking", on: true },
              ] as const).map(({ label, on }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12.5px", color: "var(--lp-text)" }}>
                  <span>{label}</span>
                  <div style={{ width: "30px", height: "16px", background: on ? "var(--lp-purple)" : "var(--lp-border2)", borderRadius: "9999px", position: "relative", flexShrink: 0 }}>
                    <span style={{ position: "absolute", left: on ? "auto" : "2px", right: on ? "2px" : "auto", top: "2px", width: "12px", height: "12px", background: on ? "#fff" : "var(--lp-muted)", borderRadius: "50%", display: "block" }} />
                  </div>
                </div>
              ))}
              <button style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-purple-l)", cursor: "pointer", padding: "4px 0", border: "none", background: "transparent", textAlign: "left", marginTop: "4px" }}>
                Configure SEO settings →
              </button>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}

/* ── Sub-components ── */

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "14px", marginBottom: "12px" }}>
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "3px" }}>{eyebrow}</div>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 400, color: "var(--lp-text)", letterSpacing: "-0.01em" }}>{title}</div>
      </div>
    </div>
  );
}

function GhostBtn({ children }: { children: React.ReactNode }) {
  return (
    <button style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "0 14px", height: "32px", borderRadius: "7px", fontSize: "12.5px", fontWeight: 500, background: "transparent", color: "var(--lp-muted2)", border: "1px solid var(--lp-border)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
      {children}
    </button>
  );
}

function SecBtn({ children }: { children: React.ReactNode }) {
  return (
    <button style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "0 14px", height: "32px", borderRadius: "7px", fontSize: "12.5px", fontWeight: 500, background: "var(--lp-bg3)", color: "var(--lp-text)", border: "1px solid var(--lp-border)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
      {children}
    </button>
  );
}

function PriBtn({ children }: { children: React.ReactNode }) {
  return (
    <button style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "0 14px", height: "32px", borderRadius: "7px", fontSize: "12.5px", fontWeight: 500, background: "var(--lp-purple)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
      {children}
    </button>
  );
}

function TabBtn({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button style={{ padding: "5px 11px", fontFamily: "var(--font-mono)", fontSize: "11px", color: active ? "var(--lp-text)" : "var(--lp-muted)", border: `1px solid ${active ? "var(--lp-border2)" : "transparent"}`, borderRadius: "6px", background: active ? "var(--lp-bg4)" : "transparent", cursor: "pointer" }}>
      {children}
    </button>
  );
}

function OppStatus({ status }: { status: "untracked" | "queued" | "drafted" | "published" }) {
  const cfg = {
    untracked: { color: "var(--lp-muted)", dot: "var(--lp-subtle)", label: "untracked" },
    queued:    { color: "var(--lp-purple-l)", dot: "var(--lp-purple)", label: "queued" },
    drafted:   { color: "var(--lp-amber)", dot: "var(--lp-amber)", label: "drafted" },
    published: { color: "var(--lp-teal)", dot: "var(--lp-teal)", label: "published" },
  }[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: cfg.color }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: cfg.dot, flexShrink: 0, display: "block" }} />
      {cfg.label}
    </span>
  );
}

function AssetStatus({ status }: { status: string }) {
  const cfg: Record<string, { color: string; bg: string; border: string }> = {
    published:      { color: "#2DD4A0", bg: "rgba(45,212,160,0.10)", border: "rgba(45,212,160,0.25)" },
    draft:          { color: "#F0A429", bg: "rgba(240,164,41,0.12)", border: "rgba(240,164,41,0.25)" },
    pending_review: { color: "#F0A429", bg: "rgba(240,164,41,0.12)", border: "rgba(240,164,41,0.25)" },
    approved:       { color: "#7C6FF7", bg: "rgba(124,111,247,0.08)", border: "rgba(124,111,247,0.2)" },
    rejected:       { color: "#F06060", bg: "rgba(240,96,96,0.12)", border: "rgba(240,96,96,0.25)" },
    archived:       { color: "#6B6B78", bg: "transparent", border: "#232328" },
  };
  const c = cfg[status] ?? cfg["draft"];
  return (
    <span style={{ display: "inline-block", fontFamily: "var(--font-mono)", fontSize: "10.5px", padding: "2px 8px", borderRadius: "9999px", fontWeight: 500, border: `1px solid ${c.border}`, color: c.color, background: c.bg }}>
      {status.replace("_", " ")}
    </span>
  );
}

function CalendarGrid({ assets }: { assets: ContentAsset[] }) {
  const today = new Date();
  const published = assets.filter((a) => a.status === "published");
  const drafted = assets.filter((a) => a.status === "draft" || a.status === "pending_review");
  const queued = assets.filter((a) => a.status === "approved");

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const calPillStyle = (type: "published" | "drafted" | "queued") => {
    const s = {
      published: { bg: "rgba(45,212,160,0.10)", color: "#2DD4A0", border: "rgba(45,212,160,0.25)" },
      drafted:   { bg: "rgba(240,164,41,0.12)", color: "#F0A429", border: "rgba(240,164,41,0.25)" },
      queued:    { bg: "rgba(124,111,247,0.08)", color: "#A99DF9", border: "rgba(124,111,247,0.2)" },
    }[type];
    return { background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: "10.5px", fontWeight: 500, fontFamily: "var(--font-sans)", padding: "3px 7px", borderRadius: "4px", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" };
  };

  const todayDow = today.getDay(); // 0=Sun, 1=Mon...
  const todayMon = todayDow === 0 ? 6 : todayDow - 1; // 0=Mon index

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "110px repeat(7, 1fr)",
  };

  const labelCellStyle: React.CSSProperties = {
    borderRight: "1px solid var(--lp-border)", borderBottom: "1px solid var(--lp-border)",
    padding: "10px 12px", minHeight: "84px", background: "var(--lp-bg2)",
    fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)",
    textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "flex-start", paddingTop: "14px"
  };

  const cellStyle = (isToday: boolean): React.CSSProperties => ({
    borderRight: "1px solid var(--lp-border)", borderBottom: "1px solid var(--lp-border)",
    padding: "10px 12px", minHeight: "84px",
    background: isToday ? "var(--lp-bg4)" : "var(--lp-bg3)",
    display: "flex", flexDirection: "column", gap: "4px", position: "relative",
  });

  const dayLabelStyle = (isToday: boolean): React.CSSProperties => ({
    fontFamily: "var(--font-mono)", fontSize: "9.5px",
    color: isToday ? "var(--lp-purple-l)" : "var(--lp-muted)",
    fontWeight: isToday ? 500 : 400, marginBottom: "4px"
  });

  const weeks = [
    { label: "This week", assets: [published[0], null, drafted[0], null, published[1], null, null] },
    { label: "Next week", assets: [queued[0], null, drafted[1], null, queued[1], null, null] },
  ];

  return (
    <div style={gridStyle}>
      {weeks.map((week, wi) => (
        <Fragment key={wi}>
          <div style={labelCellStyle}>{week.label}</div>
          {days.map((day, di) => {
            const isToday = wi === 0 && di === todayMon;
            const asset = week.assets[di];
            const assetType = asset
              ? (asset.status === "published" ? "published" : asset.status === "approved" ? "queued" : "drafted")
              : null;
            return (
              <div key={`${wi}-${di}`} style={cellStyle(isToday)}>
                {isToday && <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "var(--lp-purple)", display: "block" }} />}
                <div style={dayLabelStyle(isToday)}>{isToday ? "Today" : day}</div>
                {asset && assetType && (
                  <div style={calPillStyle(assetType)} title={asset.title}>{asset.title}</div>
                )}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

/* ── Data loading ── */

async function loadSeoData(): Promise<{
  product: Product | null;
  opportunities: KeywordOpportunity[];
  recentAssets: ContentAsset[];
  error: string | null;
  authRequired: boolean;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, opportunities: [], recentAssets: [], error: null, authRequired: false };
    }

    const contentService = new ContentService(supabase);
    const [opportunities, recentAssets] = await Promise.all([
      contentService.listKeywordOpportunities({ productId: product.id }),
      contentService.listContentAssets({ productId: product.id }),
    ]);

    return { product, opportunities, recentAssets, error: null, authRequired: false };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, opportunities: [], recentAssets: [], error: null, authRequired: true };
    }

    if (error instanceof ProductReadError || error instanceof ContentAssetReadError) {
      return { product: null, opportunities: [], recentAssets: [], error: (error as Error).message, authRequired: false };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null, opportunities: [], recentAssets: [],
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
        authRequired: false,
      };
    }

    throw error;
  }
}
