import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { FolderKanban } from "lucide-react";
import { AgentStatusHeader, type AgentStatusHeaderState } from "@/components/agent-status-header";
import { AppTopbar } from "@/components/layout/app-topbar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  autoSubmitDirectorySubmissionAction,
  requestDirectoryPackagesAction,
  updateDirectorySubmissionStatusAction,
} from "@/app/(app)/directories/actions";
import type { DirectoryTrackerItem } from "@/server/schemas/directory";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { DirectoryReadError, DirectoryService } from "@/server/services/directory-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";
import { AgentStatusReadError, AgentStatusService } from "@/server/services/agent-status-service";

type PageProps = {
  searchParams: Promise<{
    packageRequested?: string;
    packageError?: string;
    statusUpdated?: string;
    statusError?: string;
    autoSubmitted?: string;
    autoSubmitError?: string;
  }>;
};

export default async function DirectoriesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadDirectoryData();

  if (data.error) {
    return (
      <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <AppTopbar title="Directories" eyebrow="Submission tracker" />
        <div style={{ padding: "24px" }}>
          <Alert variant="destructive">
            <AlertTitle>Directory tracker could not be loaded</AlertTitle>
            <AlertDescription>{data.error}</AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

  const items = data.items;
  const live = items.filter((i) => i.submission?.status === "live");
  const submitted = items.filter((i) => i.submission?.status === "submitted");
  const pending = items.filter((i) => i.submission?.status === "pending");
  const rejected = items.filter((i) => i.submission && ["rejected", "failed"].includes(i.submission.status));
  const noSub = items.filter((i) => !i.submission);
  const packageReady = pending.filter((i) => i.submission && Object.keys(i.submission.listingPayload ?? {}).length > 0);
  const unsubmitted = [...noSub, ...pending.filter((i) => !packageReady.includes(i))];

  const topLive = live.slice().sort((a, b) => (b.directory.avgDa ?? 0) - (a.directory.avgDa ?? 0));
  const highestDA = topLive[0];

  const recentActivity: Array<{ color: string; text: string; time: string }> = items
    .filter((i) => i.submission)
    .sort((a, b) => {
      const ta = a.submission?.createdAt ?? "";
      const tb = b.submission?.createdAt ?? "";
      return tb.localeCompare(ta);
    })
    .slice(0, 5)
    .map((i) => {
      const s = i.submission!;
      const date = s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
      const statusColor =
        s.status === "live" ? "#2DD4A0" : s.status === "submitted" ? "#F0A429" : s.status === "rejected" || s.status === "failed" ? "#F06060" : "#7C6FF7";
      const statusText =
        s.status === "live" ? "listing approved and live."
        : s.status === "submitted" ? "submission entered review queue."
        : s.status === "rejected" ? "listing rejected — check submission notes."
        : s.status === "pending" ? "listing package generated, awaiting approval."
        : "submission updated.";
      return { color: statusColor, text: `${i.directory.name} — ${statusText}`, time: date };
    });

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--lp-bg)" }}>

      <AppTopbar
        title="Directories"
        eyebrow={data.product ? `Submission tracker / ${data.product.name}` : "Submission tracker"}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {data.product && (
              <form action={requestDirectoryPackagesAction} style={{ display: "inline" }}>
                <PriBtn type="submit">+ Generate packages</PriBtn>
              </form>
            )}
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 40px", display: "flex", flexDirection: "column", gap: "22px" }}>
        <AgentStatusHeader
          label="Directory agent"
          state={data.agentStatus.state}
          lastRun={data.agentStatus.lastRun}
          nextRun={data.agentStatus.nextRun}
          inboxCount={data.agentStatus.inboxCount}
        />

        {/* Alerts */}
        {params.packageRequested && (
          <Alert>
            <AlertTitle>Listing package generation requested</AlertTitle>
            <AlertDescription>Directory packages will appear here and in the approval inbox after the workflow runs.</AlertDescription>
          </Alert>
        )}
        {params.packageError && (
          <Alert variant="destructive">
            <AlertTitle>Listing package generation failed</AlertTitle>
            <AlertDescription>Try again after confirming the product and workflow configuration.</AlertDescription>
          </Alert>
        )}
        {params.statusUpdated && (
          <Alert>
            <AlertTitle>Directory status updated</AlertTitle>
            <AlertDescription>The tracker now reflects the manual submission state.</AlertDescription>
          </Alert>
        )}
        {params.statusError && (
          <Alert variant="destructive">
            <AlertTitle>Directory status update failed</AlertTitle>
            <AlertDescription>Reload the page and try again.</AlertDescription>
          </Alert>
        )}
        {params.autoSubmitted && (
          <Alert>
            <AlertTitle>Directory auto-submitted</AlertTitle>
            <AlertDescription>The supported directory submission was recorded as submitted with server-side provenance.</AlertDescription>
          </Alert>
        )}
        {params.autoSubmitError && (
          <Alert variant="destructive">
            <AlertTitle>Directory auto-submit failed</AlertTitle>
            <AlertDescription>Only pending submissions for auto-supported directories with generated packages can be submitted automatically.</AlertDescription>
          </Alert>
        )}

        {!data.product ? (
          <EmptyState icon={FolderKanban} title="No product available" description="Create a product during onboarding before LaunchBeacon can track directory submissions." />
        ) : (
          <>
            {/* KPI strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
              {[
                { label: "Total directories", value: String(items.length), delta: "in database", deltaColor: "var(--lp-muted)" },
                { label: "Live listings", value: String(live.length), delta: live.length > 0 ? "↑ active" : "none yet", deltaColor: live.length > 0 ? "var(--lp-teal)" : "var(--lp-muted)" },
                { label: "Submitted · pending", value: String(submitted.length), delta: "avg review: varies", deltaColor: "var(--lp-muted)" },
                { label: "Packages ready", value: String(packageReady.length), delta: packageReady.length > 0 ? "ready for review" : "none waiting", deltaColor: packageReady.length > 0 ? "var(--lp-purple-l)" : "var(--lp-muted)" },
              ].map((kpi) => (
                <div key={kpi.label} style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", padding: "16px 18px" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "9.5px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>{kpi.label}</div>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: "28px", color: "var(--lp-text)", letterSpacing: "-0.01em", lineHeight: 1, marginBottom: "5px" }}>{kpi.value}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: kpi.deltaColor }}>{kpi.delta}</div>
                </div>
              ))}
            </div>

            {/* Pipeline bar */}
            <div style={{ display: "flex", gap: "1px", background: "var(--lp-border)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
              {[
                { count: live.length, label: "Live", color: "#2DD4A0", active: true },
                { count: submitted.length, label: "Submitted", color: "#F0A429", active: false },
                { count: packageReady.length, label: "Package ready", color: "#A99DF9", active: false },
                { count: unsubmitted.length, label: "Unsubmitted", color: "var(--lp-muted)", active: false },
                { count: rejected.length, label: "Rejected", color: "#F06060", active: false },
              ].map((stage) => (
                <div key={stage.label} style={{ flex: 1, background: stage.active ? "var(--lp-bg4)" : "var(--lp-bg3)", padding: "18px 20px", textAlign: "center", position: "relative", cursor: "pointer" }}>
                  {stage.active && <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "2px", background: "var(--lp-purple)", display: "block" }} />}
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: "26px", color: stage.color, lineHeight: 1, marginBottom: "4px" }}>{stage.count}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{stage.label}</div>
                </div>
              ))}
            </div>

            {/* Insight callout */}
            <div style={{
              background: "linear-gradient(180deg, var(--lp-bg3) 0%, var(--lp-bg2) 100%)",
              border: "1px solid var(--lp-border)", borderLeft: "3px solid var(--lp-purple)",
              borderRadius: "9px", padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: "16px"
            }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--lp-purple-dim)", border: "1px solid rgba(124,111,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "16px", color: "var(--lp-purple-l)" }}>⚡</span>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-purple-l)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Insight · directories</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontStyle: "italic", fontWeight: 400, color: "var(--lp-text)", lineHeight: 1.3, marginBottom: "6px" }}>
                  {highestDA
                    ? `${highestDA.directory.name} is your highest-authority directory (DA ${highestDA.directory.avgDa ?? "—"}).`
                    : live.length > 0
                      ? `${live.length} directories are live. Add analytics attribution later to measure referral impact.`
                      : "Start submitting to directories to build referral traffic and backlinks."}
                </div>
                <div style={{ fontSize: "12.5px", color: "var(--lp-muted2)", lineHeight: 1.6 }}>
                  {items.length === 0
                    ? "Generate listing packages for your product to begin the submission workflow."
                    : packageReady.length > 0
                      ? <><strong style={{ color: "var(--lp-text)", fontWeight: 500 }}>{packageReady.length} listing packages</strong> are ready to submit — review and approve them in your inbox before auto-submission.</>
                      : <><strong style={{ color: "var(--lp-text)", fontWeight: 500 }}>{live.length} live</strong>, {submitted.length} submitted, {unsubmitted.length} still to reach.</>}
                </div>
              </div>
            </div>

            {/* Directory table */}
            <div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "14px", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "3px" }}>All listings</div>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 400, color: "var(--lp-text)", letterSpacing: "-0.01em" }}>Directory submission tracker</div>
                </div>
              </div>

              <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: 500, color: "var(--lp-text)" }}>
                    ⊞ Directories
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", padding: "2px 7px", background: "var(--lp-bg4)", borderRadius: "4px", fontWeight: 400 }}>
                      {items.length} total
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <TabBtn active>All</TabBtn>
                    <TabBtn>Live <span style={{ opacity: 0.6 }}>·{live.length}</span></TabBtn>
                    <TabBtn>Submitted <span style={{ opacity: 0.6 }}>·{submitted.length}</span></TabBtn>
                    <TabBtn>Ready <span style={{ opacity: 0.6 }}>·{packageReady.length}</span></TabBtn>
                    <TabBtn>Rejected <span style={{ opacity: 0.6 }}>·{rejected.length}</span></TabBtn>
                  </div>
                </div>

                {items.length === 0 ? (
                  <div style={{ padding: "40px 18px", textAlign: "center" }}>
                    <EmptyState icon={FolderKanban} title="No active directories configured" description="Generate directory packages to create review-gated submission records for the current product." />
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {[
                          { label: "Directory", align: "left", width: "28%" },
                          { label: "Category", align: "left", width: "12%" },
                          { label: "DA", align: "center", width: "9%" },
                          { label: "Status", align: "left", width: "12%" },
                          { label: "Submitted", align: "left", width: "11%" },
                          { label: "Action", align: "right", width: "16%" },
                        ].map((h) => (
                          <th key={h.label} style={{
                            fontFamily: "var(--font-mono)", fontSize: "9.5px", fontWeight: 400,
                            textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--lp-muted)",
                            textAlign: h.align as "left" | "right" | "center",
                            padding: "10px 18px", borderBottom: "1px solid var(--lp-border)", background: "var(--lp-bg2)",
                            width: h.width,
                          }}>
                            {h.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <DirRow key={item.directory.id} item={item} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Bottom grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>

              {/* Directory priority */}
              <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: 500, color: "var(--lp-text)" }}>Highest-authority live listings</div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", padding: "2px 7px", background: "var(--lp-bg4)", borderRadius: "4px" }}>by DA</span>
                </div>
                <div>
                  {topLive.length === 0 ? (
                    <div style={{ padding: "24px 18px", textAlign: "center", color: "var(--lp-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>No live directories yet</div>
                  ) : (
                    topLive.slice(0, 6).map((item, i) => (
                      <div key={item.directory.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 18px", borderBottom: i < topLive.length - 1 ? "1px solid var(--lp-border)" : "none" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-subtle)", width: "18px", flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ flex: 1, fontSize: "12.5px", fontWeight: 500, color: "var(--lp-text)" }}>{item.directory.name}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-text)" }}>DA {item.directory.avgDa ?? "—"}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", width: "36px", textAlign: "right" }}>live</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent activity */}
              <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: 500, color: "var(--lp-text)" }}>Recent activity</div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", padding: "2px 7px", background: "var(--lp-bg4)", borderRadius: "4px" }}>last 14 days</span>
                </div>
                <div>
                  {recentActivity.length === 0 ? (
                    <div style={{ padding: "24px 18px", textAlign: "center", color: "var(--lp-muted)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>No recent activity</div>
                  ) : (
                    recentActivity.map((event, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "11px 18px", borderBottom: i < recentActivity.length - 1 ? "1px solid var(--lp-border)" : "none" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: event.color, flexShrink: 0, marginTop: "5px", display: "block" }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "12.5px", color: "var(--lp-text)", lineHeight: 1.5 }}>{event.text}</div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", marginTop: "2px" }}>{event.time}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/* ── Sub-components ── */

function dirInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function DirRow({ item }: { item: DirectoryTrackerItem }) {
  const status = item.submission?.status ?? null;
  const da = item.directory.avgDa;

  const daStyle = da != null
    ? da >= 70 ? { color: "#2DD4A0", fontWeight: 500 }
    : da >= 40 ? { color: "#F0A429" }
    : { color: "var(--lp-muted)" }
    : { color: "var(--lp-muted)" };

  const submittedDate = item.submission?.submittedAt
    ? new Date(item.submission.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  const canAutoSubmit =
    status === "pending" &&
    item.directory.submissionMethod === "auto_supported" &&
    Object.keys(item.submission?.listingPayload ?? {}).length > 0;

  return (
    <tr style={{ borderBottom: "1px solid var(--lp-border)", cursor: "pointer" }}>
      <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", flexShrink: 0, background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", color: "var(--lp-muted2)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
            {dirInitials(item.directory.name)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--lp-text)" }}>{item.directory.name}</span>
            <span style={{ fontSize: "11px", color: "var(--lp-muted)", fontFamily: "var(--font-mono)" }}>
              {new URL(item.directory.url).hostname.replace("www.", "")}
            </span>
          </div>
        </div>
      </td>
      <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
        {item.directory.categories.slice(0, 1).map((cat) => (
          <span key={cat} style={{ display: "inline-block", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted2)", padding: "1px 7px", borderRadius: "4px", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)" }}>
            {cat}
          </span>
        ))}
      </td>
      <td style={{ padding: "12px 18px", textAlign: "center", verticalAlign: "middle" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", ...daStyle }}>
          {da != null ? `DA ${da}` : "—"}
        </span>
      </td>
      <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
        <StatusPill status={status} />
      </td>
      <td style={{ padding: "12px 18px", verticalAlign: "middle", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)" }}>
        {submittedDate}
      </td>
      <td style={{ padding: "12px 18px", textAlign: "right", verticalAlign: "middle" }}>
        <DirActions item={item} canAutoSubmit={canAutoSubmit} />
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const cfg = (() => {
    switch (status) {
      case "live":      return { color: "#2DD4A0", bg: "rgba(45,212,160,0.10)", border: "rgba(45,212,160,0.25)", dot: "#2DD4A0", label: "live" };
      case "submitted": return { color: "#F0A429", bg: "rgba(240,164,41,0.12)", border: "rgba(240,164,41,0.25)", dot: "#F0A429", label: "submitted" };
      case "pending":   return { color: "#A99DF9", bg: "rgba(124,111,247,0.08)", border: "rgba(124,111,247,0.2)", dot: "#7C6FF7", label: "ready" };
      case "rejected":
      case "failed":    return { color: "#F06060", bg: "rgba(240,96,96,0.12)", border: "rgba(240,96,96,0.25)", dot: "#F06060", label: status! };
      case "skipped":   return { color: "var(--lp-muted)", bg: "transparent", border: "var(--lp-border)", dot: "var(--lp-subtle)", label: "skipped" };
      default:          return { color: "var(--lp-muted)", bg: "transparent", border: "var(--lp-border)", dot: "var(--lp-subtle)", label: "unsubmitted" };
    }
  })();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontFamily: "var(--font-mono)", fontSize: "10.5px", padding: "2px 8px", borderRadius: "9999px", fontWeight: 500, border: `1px solid ${cfg.border}`, color: cfg.color, background: cfg.bg }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: cfg.dot, display: "block", flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function DirActions({ item, canAutoSubmit }: { item: DirectoryTrackerItem; canAutoSubmit: boolean }) {
  const status = item.submission?.status ?? null;

  if (!item.submission) {
    return (
      <Link href={item.directory.url} target="_blank" rel="noreferrer" style={{ padding: "4px 10px", borderRadius: "5px", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted2)", background: "transparent", border: "1px solid var(--lp-border)", display: "inline-block" }}>
        Visit site →
      </Link>
    );
  }

  if (canAutoSubmit) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
        <form action={autoSubmitDirectorySubmissionAction} style={{ display: "inline" }}>
          <input type="hidden" name="submissionId" value={item.submission.id} />
          <button type="submit" style={{ padding: "4px 10px", borderRadius: "5px", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-purple-l)", background: "var(--lp-purple-dim)", border: "1px solid rgba(124,111,247,0.2)", cursor: "pointer" }}>
            Submit →
          </button>
        </form>
        <form action={updateDirectorySubmissionStatusAction} style={{ display: "inline" }}>
          <input type="hidden" name="submissionId" value={item.submission.id} />
          <input type="hidden" name="status" value="skipped" />
          <button type="submit" style={{ padding: "4px 10px", borderRadius: "5px", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted2)", background: "transparent", border: "1px solid var(--lp-border)", cursor: "pointer" }}>
            Skip
          </button>
        </form>
      </div>
    );
  }

  if (status === "live") {
    return (
      <Link href={item.submission.liveUrl ?? item.directory.url} target="_blank" rel="noreferrer" style={{ padding: "4px 10px", borderRadius: "5px", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted2)", background: "transparent", border: "1px solid var(--lp-border)", display: "inline-block" }}>
        View listing →
      </Link>
    );
  }

  if (status === "submitted") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
        <form action={updateDirectorySubmissionStatusAction} style={{ display: "inline" }}>
          <input type="hidden" name="submissionId" value={item.submission.id} />
          <input type="hidden" name="status" value="live" />
          <button type="submit" style={{ padding: "4px 10px", borderRadius: "5px", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "#2DD4A0", background: "rgba(45,212,160,0.10)", border: "1px solid rgba(45,212,160,0.2)", cursor: "pointer" }}>
            Mark live
          </button>
        </form>
        <form action={updateDirectorySubmissionStatusAction} style={{ display: "inline" }}>
          <input type="hidden" name="submissionId" value={item.submission.id} />
          <input type="hidden" name="status" value="rejected" />
          <button type="submit" style={{ padding: "4px 10px", borderRadius: "5px", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-muted2)", background: "transparent", border: "1px solid var(--lp-border)", cursor: "pointer" }}>
            Rejected
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={updateDirectorySubmissionStatusAction} style={{ display: "inline" }}>
      <input type="hidden" name="submissionId" value={item.submission.id} />
      <input type="hidden" name="status" value="submitted" />
      <button type="submit" style={{ padding: "4px 10px", borderRadius: "5px", fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--lp-purple-l)", background: "var(--lp-purple-dim)", border: "1px solid rgba(124,111,247,0.2)", cursor: "pointer" }}>
        Mark submitted
      </button>
    </form>
  );
}

function PriBtn({ children, type }: { children: React.ReactNode; type?: "button" | "submit" }) {
  return (
    <button type={type ?? "button"} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "0 14px", height: "32px", borderRadius: "7px", fontSize: "12.5px", fontWeight: 500, background: "var(--lp-purple)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
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

/* ── Data loading ── */

async function loadDirectoryData(): Promise<{
  product: Product | null;
  items: DirectoryTrackerItem[];
  agentStatus: {
    state: AgentStatusHeaderState;
    lastRun: string;
    nextRun: string;
    inboxCount: number;
  };
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, items: [], agentStatus: emptyAgentStatus("not_configured"), error: null };
    }

    const items = await new DirectoryService(supabase).listTracker({ productId: product.id });
    const agentStatus = await new AgentStatusService(supabase).getHeader({
      productId: product.id,
      channel: "directories",
      itemUpdatedAts: items.flatMap((item) => item.submission?.updatedAt ? [item.submission.updatedAt] : []),
    });
    return { product, items, agentStatus, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, items: [], agentStatus: emptyAgentStatus("not_configured"), error: (error as Error).message };
    }

    if (error instanceof ProductReadError || error instanceof DirectoryReadError || error instanceof AgentStatusReadError) {
      return { product: null, items: [], agentStatus: emptyAgentStatus("not_configured"), error: (error as Error).message };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null, items: [], agentStatus: emptyAgentStatus("not_configured"),
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}

function emptyAgentStatus(state: AgentStatusHeaderState) {
  return {
    state,
    lastRun: "No runs yet",
    nextRun: "Not scheduled",
    inboxCount: 0,
  };
}

