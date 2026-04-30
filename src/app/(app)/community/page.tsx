import Link from "next/link";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requestCommunityReplyGenerationAction,
  requestCommunityThreadIngestionAction,
} from "@/app/(app)/community/actions";
import type { CommunityThread } from "@/server/schemas/community";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import {
  CommunityService,
  CommunityThreadReadError,
} from "@/server/services/community-service";
import {
  ProductReadError,
  ProductService,
} from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{
    ingestionRequested?: string;
    ingestionError?: string;
    draftRequested?: string;
    draftError?: string;
  }>;
};

export default async function CommunityPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadCommunityData();
  const threads = data.threads;

  // KPI values
  const postedCount = threads.filter((t) => t.status === "posted").length;
  const avgRelevance =
    threads.length > 0
      ? Math.round(
          (threads.reduce((sum, t) => sum + t.relevanceScore, 0) /
            threads.length) *
            100,
        )
      : null;

  // Insight callout
  const topPosted =
    postedCount > 0
      ? threads
          .filter((t) => t.status === "posted")
          .sort((a, b) => b.relevanceScore - a.relevanceScore)[0]
      : null;

  // Platform breakdown
  const platformMap: Record<string, { total: number; posted: number }> = {};
  for (const t of threads) {
    const key = t.platform;
    if (!platformMap[key]) platformMap[key] = { total: 0, posted: 0 };
    platformMap[key].total++;
    if (t.status === "posted") platformMap[key].posted++;
  }
  const platforms = Object.entries(platformMap);

  const demoPlatforms = [
    { name: "reddit", total: 12, posted: 3 },
    { name: "hacker_news", total: 7, posted: 1 },
    { name: "indie_hackers", total: 4, posted: 0 },
    { name: "x", total: 2, posted: 0 },
  ];

  const demoThreads: Array<{
    platform: string;
    title: string;
    author: string;
    relevance: number;
    status: string;
    promScore: string;
    postedAt: string;
  }> = [
    {
      platform: "reddit",
      title: "Best tools for finding PMF in niche B2B markets?",
      author: "u/startupgrinder",
      relevance: 91,
      status: "posted",
      promScore: "18%",
      postedAt: "Apr 18",
    },
    {
      platform: "hacker_news",
      title: "Ask HN: How do you validate SaaS ideas before building?",
      author: "hn/throwawayfound",
      relevance: 84,
      status: "drafted",
      promScore: "22%",
      postedAt: "—",
    },
    {
      platform: "indie_hackers",
      title: "Struggling with early-stage content marketing — any wins?",
      author: "ih/launchday",
      relevance: 77,
      status: "observed",
      promScore: "—",
      postedAt: "—",
    },
    {
      platform: "reddit",
      title: "What's the actual ROI of community engagement for SaaS?",
      author: "u/growthops",
      relevance: 68,
      status: "observed",
      promScore: "—",
      postedAt: "—",
    },
    {
      platform: "x",
      title: "Thread: 5 underrated marketing channels for early-stage startups",
      author: "@product_lens",
      relevance: 61,
      status: "skipped",
      promScore: "34%",
      postedAt: "—",
    },
  ];

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <AppTopbar
        title="Community"
        eyebrow={
          data.product
            ? `Thread intelligence · ${data.product.name}`
            : "Thread intelligence"
        }
        actions={
          <>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--lp-muted)",
                padding: "3px 8px",
                background: "var(--lp-bg3)",
                border: "1px solid var(--lp-border)",
                borderRadius: "5px",
              }}
            >
              {threads.length} threads
            </span>
            {data.product ? (
              <form action={requestCommunityThreadIngestionAction}>
                <button
                  type="submit"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11.5px",
                    fontWeight: 500,
                    padding: "6px 14px",
                    borderRadius: "7px",
                    border: "1px solid var(--lp-purple)",
                    background: "var(--lp-purple-dim)",
                    color: "var(--lp-purple-l)",
                    cursor: "pointer",
                    letterSpacing: "0.01em",
                  }}
                >
                  ⟳ Scan threads
                </button>
              </form>
            ) : null}
            <button
              type="button"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11.5px",
                padding: "6px 14px",
                borderRadius: "7px",
                border: "1px solid var(--lp-border)",
                background: "transparent",
                color: "var(--lp-muted)",
                cursor: "pointer",
              }}
            >
              Export
            </button>
          </>
        }
      />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "22px 28px 40px",
          display: "flex",
          flexDirection: "column",
          gap: "22px",
        }}
      >
        {/* Alert feedback */}
        {params.ingestionRequested ? (
          <Alert>
            <AlertTitle>Thread scan requested</AlertTitle>
            <AlertDescription>
              LaunchBeacon will score relevant community threads from the current
              Marketing Brief.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.ingestionError || data.error ? (
          <Alert variant="destructive">
            <AlertTitle>Community threads could not be loaded</AlertTitle>
            <AlertDescription>
              {data.error ??
                "Try again after confirming the product and workflow configuration."}
            </AlertDescription>
          </Alert>
        ) : null}
        {params.draftRequested ? (
          <Alert>
            <AlertTitle>Reply draft requested</AlertTitle>
            <AlertDescription>
              A review-gated community reply will appear here and in the inbox
              after guardrail scoring.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.draftError ? (
          <Alert variant="destructive">
            <AlertTitle>Reply draft request failed</AlertTitle>
            <AlertDescription>
              Only observed, drafted, or failed threads can request a new reply
              draft.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* KPI strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "10px",
          }}
        >
          {/* Monitored threads */}
          <div
            style={{
              background: "var(--lp-bg3)",
              border: "1px solid var(--lp-border)",
              borderRadius: "10px",
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                color: "var(--lp-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "6px",
              }}
            >
              Monitored threads
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "28px",
                color: "var(--lp-text)",
                letterSpacing: "-0.01em",
                lineHeight: 1,
                marginBottom: "5px",
              }}
            >
              {threads.length}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--lp-muted2)",
              }}
            >
              ↑ scanned this week
            </div>
          </div>

          {/* Replies posted */}
          <div
            style={{
              background: "var(--lp-bg3)",
              border: "1px solid var(--lp-border)",
              borderRadius: "10px",
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                color: "var(--lp-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "6px",
              }}
            >
              Replies posted
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "28px",
                color: "var(--lp-text)",
                letterSpacing: "-0.01em",
                lineHeight: 1,
                marginBottom: "5px",
              }}
            >
              {postedCount}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "#2DD4A0",
              }}
            >
              {postedCount > 0 ? `↑ ${postedCount} approved & live` : "none live yet"}
            </div>
          </div>

          {/* Avg. relevance */}
          <div
            style={{
              background: "var(--lp-bg3)",
              border: "1px solid var(--lp-border)",
              borderRadius: "10px",
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                color: "var(--lp-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "6px",
              }}
            >
              Avg. relevance
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "28px",
                color: "var(--lp-text)",
                letterSpacing: "-0.01em",
                lineHeight: 1,
                marginBottom: "5px",
              }}
            >
              {avgRelevance !== null ? `${avgRelevance}%` : "—"}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--lp-muted2)",
              }}
            >
              across all threads
            </div>
          </div>

          {/* Traffic from community */}
          <div
            style={{
              background: "var(--lp-bg3)",
              border: "1px solid var(--lp-border)",
              borderRadius: "10px",
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                color: "var(--lp-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "6px",
              }}
            >
              Traffic from community
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "28px",
                color: "var(--lp-text)",
                letterSpacing: "-0.01em",
                lineHeight: 1,
                marginBottom: "5px",
              }}
            >
              —
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--lp-muted2)",
              }}
            >
              analytics not connected
            </div>
          </div>
        </div>

        {/* Insight callout */}
        <div
          style={{
            background:
              "linear-gradient(180deg, var(--lp-bg3) 0%, var(--lp-bg2) 100%)",
            border: "1px solid var(--lp-border)",
            borderLeft: "3px solid var(--lp-purple)",
            borderRadius: "9px",
            padding: "16px 20px",
            display: "flex",
            alignItems: "flex-start",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "var(--lp-purple-dim)",
              border: "1px solid rgba(124,111,247,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "16px", color: "var(--lp-purple-l)" }}>
              ⚡
            </span>
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--lp-purple-l)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "4px",
              }}
            >
              INSIGHT · COMMUNITY
            </div>
            {topPosted ? (
              <>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "18px",
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: "var(--lp-text)",
                    lineHeight: 1.3,
                    marginBottom: "6px",
                  }}
                >
                  Your highest-relevance posted reply scored{" "}
                  {Math.round(topPosted.relevanceScore * 100)}%.
                </div>
                <div
                  style={{
                    fontSize: "12.5px",
                    color: "var(--lp-muted2)",
                    lineHeight: 1.6,
                  }}
                >
                  Thread:{" "}
                  <strong
                    style={{ color: "var(--lp-text)", fontWeight: 500 }}
                  >
                    {topPosted.threadTitle}
                  </strong>{" "}
                  on{" "}
                  <strong
                    style={{ color: "var(--lp-text)", fontWeight: 500 }}
                  >
                    {topPosted.platform}
                  </strong>
                  . Keep approving high-relevance replies to build community
                  presence.
                </div>
              </>
            ) : threads.length > 0 ? (
              <>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "18px",
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: "var(--lp-text)",
                    lineHeight: 1.3,
                    marginBottom: "6px",
                  }}
                >
                  {threads.length} thread
                  {threads.length !== 1 ? "s" : ""} scanned — none posted yet.
                </div>
                <div
                  style={{
                    fontSize: "12.5px",
                    color: "var(--lp-muted2)",
                    lineHeight: 1.6,
                  }}
                >
                  Draft replies on high-relevance threads and approve them in
                  the{" "}
                  <strong style={{ color: "var(--lp-text)", fontWeight: 500 }}>
                    inbox
                  </strong>{" "}
                  to go live.
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "18px",
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: "var(--lp-text)",
                    lineHeight: 1.3,
                    marginBottom: "6px",
                  }}
                >
                  Complete the Marketing Brief to start scanning community
                  threads.
                </div>
                <div
                  style={{
                    fontSize: "12.5px",
                    color: "var(--lp-muted2)",
                    lineHeight: 1.6,
                  }}
                >
                  LaunchBeacon monitors Reddit, Hacker News, and Indie Hackers
                  for{" "}
                  <strong style={{ color: "var(--lp-text)", fontWeight: 500 }}>
                    genuine conversations
                  </strong>{" "}
                  where your product is relevant.
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main table */}
        <div
          style={{
            background: "var(--lp-bg3)",
            border: "1px solid var(--lp-border)",
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 18px",
              borderBottom: "1px solid var(--lp-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--lp-text)",
              }}
            >
              Community threads
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--lp-muted)",
                  padding: "2px 7px",
                  background: "var(--lp-bg4)",
                  borderRadius: "4px",
                  fontWeight: 400,
                }}
              >
                {threads.length > 0 ? threads.length : demoThreads.length}
              </span>
            </div>
            {threads.length === 0 && data.product && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--lp-amber)",
                  padding: "2px 8px",
                  background: "rgba(240,164,41,0.10)",
                  border: "1px solid rgba(240,164,41,0.20)",
                  borderRadius: "5px",
                }}
              >
                sample data
              </span>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "860px",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Platform",
                    "Thread",
                    "Relevance",
                    "Status",
                    "Prom. score",
                    "Posted",
                    "Action",
                  ].map((col, i) => (
                    <th
                      key={col}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "9.5px",
                        fontWeight: 400,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--lp-muted)",
                        textAlign: i === 6 ? "right" : "left",
                        padding: "10px 18px",
                        borderBottom: "1px solid var(--lp-border)",
                        background: "var(--lp-bg2)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {threads.length > 0
                  ? threads.map((thread) => (
                      <ThreadRow key={thread.id} thread={thread} />
                    ))
                  : data.product
                    ? demoThreads.map((row, i) => (
                        <DemoThreadRow key={i} row={row} />
                      ))
                    : null}
                {!data.product && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: "40px 18px",
                        textAlign: "center",
                        fontFamily: "var(--font-mono)",
                        fontSize: "12px",
                        color: "var(--lp-muted)",
                      }}
                    >
                      Create a product during onboarding before LaunchBeacon can
                      scan community threads.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom 2-col grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          {/* Platform breakdown */}
          <div
            style={{
              background: "var(--lp-bg3)",
              border: "1px solid var(--lp-border)",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 18px",
                borderBottom: "1px solid var(--lp-border)",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--lp-text)",
              }}
            >
              Platform breakdown
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--lp-muted)",
                  padding: "2px 7px",
                  background: "var(--lp-bg4)",
                  borderRadius: "4px",
                  fontWeight: 400,
                }}
              >
                {platforms.length > 0 ? platforms.length : demoPlatforms.length}{" "}
                platforms
              </span>
            </div>
            <div style={{ padding: "6px 0" }}>
              {(platforms.length > 0
                ? platforms.map(([name, counts]) => ({
                    name,
                    total: counts.total,
                    posted: counts.posted,
                  }))
                : demoPlatforms
              ).map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 18px",
                    borderBottom: "1px solid var(--lp-border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: "var(--lp-purple)",
                        display: "block",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "12px",
                        color: "var(--lp-text)",
                      }}
                    >
                      {p.name.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: "var(--lp-muted2)",
                      }}
                    >
                      {p.total} threads
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: p.posted > 0 ? "#2DD4A0" : "var(--lp-muted)",
                        padding: "1px 6px",
                        background:
                          p.posted > 0
                            ? "rgba(45,212,160,0.10)"
                            : "var(--lp-bg4)",
                        border: `1px solid ${p.posted > 0 ? "rgba(45,212,160,0.20)" : "var(--lp-border)"}`,
                        borderRadius: "4px",
                      }}
                    >
                      {p.posted} posted
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Authenticity guardrails */}
          <div
            style={{
              background: "var(--lp-bg3)",
              border: "1px solid var(--lp-border)",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 18px",
                borderBottom: "1px solid var(--lp-border)",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--lp-text)",
              }}
            >
              Reply guardrails
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "#2DD4A0",
                  padding: "2px 7px",
                  background: "rgba(45,212,160,0.10)",
                  border: "1px solid rgba(45,212,160,0.20)",
                  borderRadius: "4px",
                  fontWeight: 400,
                }}
              >
                active
              </span>
            </div>
            <div style={{ padding: "6px 0" }}>
              {[
                {
                  label: "Community replies",
                  value: "Level 1 — review all",
                  color: "var(--lp-purple-l)",
                  bg: "var(--lp-purple-dim)",
                  dot: "var(--lp-purple)",
                },
                {
                  label: "Original posts",
                  value: "Always requires approval",
                  color: "var(--lp-muted2)",
                  bg: "var(--lp-bg4)",
                  dot: "var(--lp-muted)",
                  locked: true,
                },
                {
                  label: "Disclosure language",
                  value: "Auto-appended",
                  color: "#2DD4A0",
                  bg: "rgba(45,212,160,0.10)",
                  dot: "#2DD4A0",
                },
                {
                  label: "Daily post limit",
                  value: "2 / community",
                  color: "var(--lp-amber)",
                  bg: "rgba(240,164,41,0.10)",
                  dot: "var(--lp-amber)",
                },
                {
                  label: "Promotional score threshold",
                  value: "≤40%",
                  color: "var(--lp-muted2)",
                  bg: "var(--lp-bg4)",
                  dot: "var(--lp-muted2)",
                },
              ].map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 18px",
                    borderBottom: "1px solid var(--lp-border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: row.dot,
                        display: "block",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "12.5px",
                        color: "var(--lp-text)",
                      }}
                    >
                      {row.label}
                      {row.locked && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "9px",
                            color: "var(--lp-muted)",
                            marginLeft: "6px",
                            letterSpacing: "0.04em",
                          }}
                        >
                          LOCKED
                        </span>
                      )}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      color: row.color,
                      padding: "2px 7px",
                      background: row.bg,
                      border: `1px solid ${row.dot}22`,
                      borderRadius: "5px",
                    }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function relevanceColor(pct: number): string {
  if (pct >= 80) return "#2DD4A0";
  if (pct >= 60) return "var(--lp-amber)";
  return "var(--lp-red)";
}

function StatusPill({ status }: { status: string }) {
  let color = "var(--lp-muted2)";
  let bg = "var(--lp-bg4)";
  let border = "var(--lp-border)";

  if (status === "posted") {
    color = "#2DD4A0";
    bg = "rgba(45,212,160,0.10)";
    border = "rgba(45,212,160,0.25)";
  } else if (status === "failed" || status === "blocked") {
    color = "var(--lp-red)";
    bg = "var(--lp-red-dim)";
    border = "rgba(240,96,96,0.25)";
  } else if (status === "drafted" || status === "pending_review" || status === "approved") {
    color = "var(--lp-purple-l)";
    bg = "var(--lp-purple-dim)";
    border = "rgba(124,111,247,0.25)";
  } else if (status === "observed") {
    color = "var(--lp-muted2)";
    bg = "var(--lp-bg4)";
    border = "var(--lp-border)";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontFamily: "var(--font-mono)",
        fontSize: "10.5px",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontWeight: 500,
        border: `1px solid ${border}`,
        color,
        background: bg,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: color,
          display: "block",
          flexShrink: 0,
        }}
      />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ThreadRow({ thread }: { thread: CommunityThread }) {
  const relPct = Math.round(thread.relevanceScore * 100);

  return (
    <tr
      style={{ borderBottom: "1px solid var(--lp-border)" }}
    >
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--lp-muted2)",
          whiteSpace: "nowrap",
        }}
      >
        {thread.platform.replace(/_/g, " ")}
      </td>
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          maxWidth: "300px",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            color: "var(--lp-text)",
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {thread.threadTitle}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            color: "var(--lp-muted)",
            marginTop: "2px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {thread.threadAuthorHandle ?? "unknown author"}
        </div>
      </td>
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          color: relevanceColor(relPct),
          fontWeight: 600,
        }}
      >
        {relPct}%
      </td>
      <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
        <StatusPill status={thread.status} />
      </td>
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          color: "var(--lp-muted2)",
        }}
      >
        {thread.promotionalScore !== null
          ? `${Math.round(thread.promotionalScore * 100)}%`
          : "—"}
      </td>
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          color: "var(--lp-muted2)",
          whiteSpace: "nowrap",
        }}
      >
        {thread.postedAt
          ? new Date(thread.postedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : "—"}
      </td>
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          textAlign: "right",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}
        >
          {["observed", "drafted", "failed"].includes(thread.status) && (
            <form action={requestCommunityReplyGenerationAction}>
              <input type="hidden" name="threadId" value={thread.id} />
              <button
                type="submit"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 500,
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--lp-border2)",
                  background: "var(--lp-bg4)",
                  color: "var(--lp-text)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Draft
              </button>
            </form>
          )}
          <Link
            href={thread.threadUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid var(--lp-border)",
              background: "transparent",
              color: "var(--lp-muted)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Open ↗
          </Link>
        </div>
      </td>
    </tr>
  );
}

function DemoThreadRow({
  row,
}: {
  row: {
    platform: string;
    title: string;
    author: string;
    relevance: number;
    status: string;
    promScore: string;
    postedAt: string;
  };
}) {
  return (
    <tr
      style={{
        borderBottom: "1px solid var(--lp-border)",
        opacity: 0.65,
      }}
    >
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--lp-muted2)",
          whiteSpace: "nowrap",
        }}
      >
        {row.platform.replace(/_/g, " ")}
      </td>
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          maxWidth: "300px",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            color: "var(--lp-text)",
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.title}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            color: "var(--lp-muted)",
            marginTop: "2px",
          }}
        >
          {row.author}
        </div>
      </td>
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          color: relevanceColor(row.relevance),
          fontWeight: 600,
        }}
      >
        {row.relevance}%
      </td>
      <td style={{ padding: "12px 18px", verticalAlign: "middle" }}>
        <StatusPill status={row.status} />
      </td>
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          color: "var(--lp-muted2)",
        }}
      >
        {row.promScore}
      </td>
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          color: "var(--lp-muted2)",
        }}
      >
        {row.postedAt}
      </td>
      <td
        style={{
          padding: "12px 18px",
          verticalAlign: "middle",
          textAlign: "right",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--lp-muted)",
          }}
        >
          —
        </span>
      </td>
    </tr>
  );
}

async function loadCommunityData(): Promise<{
  product: Product | null;
  threads: CommunityThread[];
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, threads: [], error: null };
    }

    const threads = await new CommunityService(supabase).listThreads({
      productId: product.id,
    });
    return { product, threads, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, threads: [], error: error.message };
    }

    if (
      error instanceof ProductReadError ||
      error instanceof CommunityThreadReadError
    ) {
      return { product: null, threads: [], error: error.message };
    }

    if (
      error instanceof Error &&
      error.message.includes("Supabase URL and publishable key")
    ) {
      return {
        product: null,
        threads: [],
        error:
          "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}

function countThreads(threads: CommunityThread[]) {
  return {
    observed: String(
      threads.filter((thread) => thread.status === "observed").length,
    ),
    drafted: String(
      threads.filter((thread) => thread.status === "drafted").length,
    ),
    pendingReview: String(
      threads.filter(
        (thread) =>
          thread.status === "pending_review" || thread.status === "approved",
      ).length,
    ),
    closed: String(
      threads.filter(
        (thread) =>
          thread.status === "posted" || thread.status === "skipped",
      ).length,
    ),
  };
}

// Keep countThreads in scope for potential future use — suppressed lint warning
void countThreads;
