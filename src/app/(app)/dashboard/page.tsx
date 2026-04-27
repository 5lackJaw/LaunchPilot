import Link from "next/link";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requestWeeklyDigestAction } from "@/app/(app)/dashboard/actions";
import type { DashboardSummary, KeywordMovement, TrafficSourceBreakdown } from "@/server/schemas/analytics";
import type { InboxItem } from "@/server/schemas/inbox";
import type { Product } from "@/server/schemas/product";
import { AnalyticsReadError, AnalyticsService, formatSourceLabel } from "@/server/services/analytics-service";
import { AuthRequiredError } from "@/server/services/auth-service";
import { InboxItemReadError, InboxService } from "@/server/services/inbox-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{
    digestRequested?: string;
    digestError?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadDashboardData();

  if (data.authRequired) {
    return <DashboardShell errorTitle="Sign in required" error="Sign in before viewing the dashboard." />;
  }

  if (data.error) {
    return <DashboardShell errorTitle="Dashboard could not be loaded" error={data.error} destructive />;
  }

  if (!data.product || !data.summary) {
    return (
      <main className="flex min-h-screen flex-col">
        <AppTopbar title="Dashboard" eyebrow="Weekly operating view" />
        <div className="p-7">
          <div className="rounded-[10px] border bg-card p-5">
            <h2 className="text-sm font-medium">No product yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create a product during onboarding before analytics can be shown.</p>
          </div>
        </div>
      </main>
    );
  }

  const summary = data.summary;

  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar
        title="Dashboard"
        eyebrow="Weekly operating view"
        productName={data.product.name}
        actions={
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11.5px] text-muted-foreground">{summary.currentPeriod.label}</span>
            <form action={requestWeeklyDigestAction}>
              <Button type="submit" variant="outline" size="sm">
                Generate digest
              </Button>
            </form>
            <Button size="sm" asChild>
              <Link href="/inbox">Review inbox</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-5 p-7">
        {params.digestRequested ? (
          <Alert>
            <AlertTitle>Weekly digest requested</AlertTitle>
            <AlertDescription>The digest workflow will persist a weekly brief, create an inbox recommendation, and send email if configured.</AlertDescription>
          </Alert>
        ) : null}
        {params.digestError ? (
          <Alert variant="destructive">
            <AlertTitle>Weekly digest request failed</AlertTitle>
            <AlertDescription>Try again after confirming the product and workflow configuration.</AlertDescription>
          </Alert>
        ) : null}
        <InsightBar summary={summary} />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Visitors" period={summary.currentPeriod.label} value={summary.visitors.toLocaleString()} delta={formatDelta(summary.visitorDeltaPercent, "wk-over-wk")} tone="up">
            <SparklineLine values={sparklineFromTotal(summary.visitors)} />
          </MetricCard>
          <MetricCard
            label="Published assets"
            period={summary.currentPeriod.label}
            value={String(summary.publishedAssets)}
            delta={`${summary.publishedAssetDelta >= 0 ? "+" : ""}${summary.publishedAssetDelta} vs prior week`}
            tone={summary.publishedAssetDelta >= 0 ? "up" : "down"}
          >
            <SparklineBar values={sparklineFromTotal(Math.max(summary.publishedAssets, 1))} />
          </MetricCard>
          <MetricCard label="Conversions" period={summary.currentPeriod.label} value={summary.conversions.toLocaleString()} delta={formatDelta(summary.conversionDeltaPercent, "wk-over-wk")} tone="up">
            <SparklineBar values={sparklineFromTotal(summary.conversions)} teal />
          </MetricCard>
          <MetricCard
            label="Inbox pending"
            period="right now"
            value={String(summary.pendingInboxItems)}
            delta={summary.pendingInboxItems ? `~ ${summary.estimatedReviewMinutes} min to review` : "clear"}
            tone="neutral"
          >
            <InboxBreakdown items={data.pendingInboxItems} />
          </MetricCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-4">
            <InboxPreview items={data.pendingInboxItems} pendingCount={summary.pendingInboxItems} />
            <KeywordPositions keywords={summary.keywordMovement} />
            <ContentPerformanceTable summary={summary} />
          </div>

          <aside className="flex flex-col gap-4">
            <ChannelHealth summary={summary} />
            <TrafficSources sources={summary.sourceBreakdown} />
            <AutopilotPanel />
          </aside>
        </section>
      </div>
    </main>
  );
}

function DashboardShell({ errorTitle, error, destructive }: { errorTitle: string; error: string; destructive?: boolean }) {
  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar title="Dashboard" eyebrow="Weekly operating view" />
      <div className="p-7">
        <Alert variant={destructive ? "destructive" : "default"}>
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    </main>
  );
}

function InsightBar({ summary }: { summary: DashboardSummary }) {
  return (
    <section
      className="flex items-start gap-4 rounded-[9px] border p-4"
      style={{ borderLeftWidth: 3, borderLeftColor: "hsl(var(--primary))", background: "linear-gradient(180deg, hsl(240 7% 11%) 0%, hsl(240 7% 8%) 100%)" }}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border text-base" style={{ background: "hsl(var(--primary) / 0.08)", borderColor: "hsl(var(--primary) / 0.15)", color: "hsl(246 88% 80%)" }}>
        *
      </div>
      <div className="flex-1">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: "hsl(246 88% 80%)" }}>
          Insight / this week
        </p>
        <p className="mb-1.5 font-serif text-[18px] leading-snug text-foreground">{summary.weeklyInsight.title}</p>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">{summary.weeklyInsight.body}</p>
        {summary.weeklyInsight.actionLabel ? (
          <div className="mt-3">
            <Button size="sm" asChild>
              <Link href="/inbox">{summary.weeklyInsight.actionLabel}</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  period,
  value,
  delta,
  tone,
  children,
}: {
  label: string;
  period: string;
  value: string;
  delta: string;
  tone: "up" | "down" | "neutral";
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-[10px] border bg-card p-4 transition-colors hover:border-border/60">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground">{label}</span>
        <span className="font-mono text-[9.5px] tracking-[0.03em] text-muted-foreground">{period}</span>
      </div>
      <div className="font-serif text-[28px] leading-none text-foreground">{value}</div>
      <div className={tone === "up" ? "mt-1.5 font-mono text-[11.5px] text-teal-400" : tone === "down" ? "mt-1.5 font-mono text-[11.5px] text-red-400" : "mt-1.5 font-mono text-[11.5px] text-muted-foreground"}>{delta}</div>
      {children}
    </div>
  );
}

function SparklineLine({ values }: { values: number[] }) {
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 120},${28 - value}`).join(" ");

  return (
    <svg viewBox="0 0 120 28" fill="none" aria-hidden className="mt-3 h-7 w-full">
      <polyline points={points} stroke="hsl(var(--accent))" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparklineBar({ values, teal }: { values: number[]; teal?: boolean }) {
  const max = Math.max(...values, 1);
  const barWidth = 14;
  const gap = (120 - barWidth * values.length) / (values.length - 1);

  return (
    <svg viewBox="0 0 120 28" fill="none" aria-hidden className="mt-3 h-7 w-full">
      {values.map((value, index) => {
        const height = Math.max(2, (value / max) * 26);
        return (
          <rect
            key={`${value}-${index}`}
            x={index * (barWidth + gap)}
            y={28 - height}
            width={barWidth}
            height={height}
            fill={teal ? "hsl(var(--accent))" : "hsl(var(--primary))"}
            rx="2"
            opacity={0.3 + (index / values.length) * 0.7}
          />
        );
      })}
    </svg>
  );
}

function InboxBreakdown({ items }: { items: InboxItem[] }) {
  const groups = {
    content_draft: items.filter((item) => item.itemType === "content_draft").length,
    community_reply: items.filter((item) => item.itemType === "community_reply").length,
    directory_package: items.filter((item) => item.itemType === "directory_package").length,
    outreach_email: items.filter((item) => item.itemType === "outreach_email").length,
  };

  if (!items.length) {
    return <p className="mt-3 font-mono text-[10.5px] text-muted-foreground">No pending review work.</p>;
  }

  return (
    <>
      <div className="mt-3 flex items-center gap-1" aria-label="Breakdown by type">
        <div className="h-[5px] rounded bg-primary opacity-90" style={{ flex: Math.max(groups.content_draft, 1) }} />
        <div className="h-[5px] rounded opacity-85" style={{ flex: Math.max(groups.community_reply, 1), background: "hsl(var(--accent))" }} />
        <div className="h-[5px] rounded bg-amber-400 opacity-85" style={{ flex: Math.max(groups.directory_package, 1) }} />
        <div className="h-[5px] rounded bg-red-400 opacity-75" style={{ flex: Math.max(groups.outreach_email, 1) }} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-2 font-mono text-[10px]">
        <span style={{ color: "hsl(246 88% 80%)" }}>{groups.content_draft} content</span>
        <span style={{ color: "hsl(var(--accent))" }}>{groups.community_reply} replies</span>
        <span className="text-amber-400">{groups.directory_package} listings</span>
        <span className="text-red-400">{groups.outreach_email} emails</span>
      </div>
    </>
  );
}

function InboxPreview({ items, pendingCount }: { items: InboxItem[]; pendingCount: number }) {
  return (
    <section className="overflow-hidden rounded-[10px] border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-[18px] py-[14px]">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-foreground">Approval inbox</span>
          <span className="rounded border px-[7px] py-[2px] font-mono text-[9.5px] font-medium text-amber-400" style={{ background: "hsl(38 86% 50% / 0.08)", borderColor: "hsl(38 86% 50% / 0.2)" }}>
            {pendingCount} pending
          </span>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/inbox">View all</Link>
        </Button>
      </div>
      {items.length ? (
        items.slice(0, 5).map((item) => <InboxPreviewRow key={item.id} item={item} />)
      ) : (
        <p className="px-[18px] py-5 text-sm text-muted-foreground">No pending inbox items.</p>
      )}
    </section>
  );
}

function InboxPreviewRow({ item }: { item: InboxItem }) {
  const title = typeof item.payload.title === "string" ? item.payload.title : item.itemType.replace(/_/g, " ");

  return (
    <Link href={`/inbox/${item.id}`} className="grid items-start gap-3 border-b px-[18px] py-3 last:border-b-0 hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" style={{ gridTemplateColumns: "auto 1fr auto" }}>
      <span className="mt-[2px] rounded border px-[7px] py-[2px] font-mono text-[9.5px] font-medium text-primary">{item.itemType.replace("_", " ")}</span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-foreground">{title}</span>
        <span className="mt-[3px] block truncate text-[11.5px] text-muted-foreground">
          {item.impactEstimate} impact / {item.aiConfidence === null ? "no confidence score" : `${Math.round(item.aiConfidence * 100)}% confidence`}
        </span>
      </span>
      <span className="font-mono text-[10.5px] text-muted-foreground">{formatRelativeTime(item.createdAt)}</span>
    </Link>
  );
}

function KeywordPositions({ keywords }: { keywords: KeywordMovement[] }) {
  return (
    <section className="overflow-hidden rounded-[10px] border bg-card">
      <div className="flex items-center justify-between border-b px-[18px] py-[14px]">
        <span className="text-[13px] font-medium text-foreground">Keyword positions</span>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/analytics">Full report</Link>
        </Button>
      </div>
      {keywords.length ? (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Keyword", "Position", "Change", "Source"].map((heading) => (
                <th key={heading} className="border-b px-[18px] py-[9px] text-left font-mono text-[10.5px] font-normal uppercase tracking-[0.05em] text-muted-foreground">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keywords.slice(0, 5).map((keyword) => (
              <tr key={keyword.keyword} className="hover:bg-secondary">
                <td className="border-b px-[18px] py-2.5 text-[12.5px] text-foreground">{keyword.keyword}</td>
                <td className="border-b px-[18px] py-2.5 font-mono text-[12px] text-teal-400">#{keyword.currentPosition}</td>
                <td className={keyword.trend === "up" ? "border-b px-[18px] py-2.5 font-mono text-[10.5px] text-teal-400" : keyword.trend === "down" ? "border-b px-[18px] py-2.5 font-mono text-[10.5px] text-red-400" : "border-b px-[18px] py-2.5 font-mono text-[10.5px] text-muted-foreground"}>
                  {formatRankChange(keyword)}
                </td>
                <td className="border-b px-[18px] py-2.5 font-mono text-[10.5px] text-muted-foreground">{keyword.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="px-[18px] py-5 text-sm text-muted-foreground">No keyword rank snapshots yet.</p>
      )}
    </section>
  );
}

function ContentPerformanceTable({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="overflow-hidden rounded-[10px] border bg-card">
      <div className="flex items-center justify-between border-b px-[18px] py-[14px]">
        <span className="text-[13px] font-medium text-foreground">Content performance</span>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/content">Open library</Link>
        </Button>
      </div>
      {summary.contentPerformance.length ? (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Asset", "Status", "Keyword rank", "Visits"].map((heading) => (
                <th key={heading} className="border-b px-[18px] py-[9px] text-left font-mono text-[10.5px] font-normal uppercase tracking-[0.05em] text-muted-foreground">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.contentPerformance.slice(0, 6).map((asset) => (
              <tr key={asset.id} className="hover:bg-secondary">
                <td className="border-b px-[18px] py-2.5 text-[12.5px] text-foreground">
                  <Link href={`/content/${asset.id}`} className="block truncate hover:text-primary">
                    {asset.title}
                  </Link>
                </td>
                <td className="border-b px-[18px] py-2.5 font-mono text-[10.5px] text-muted-foreground">{asset.status}</td>
                <td className="border-b px-[18px] py-2.5 font-mono text-[10.5px] text-muted-foreground">
                  {asset.currentPosition ? `#${asset.currentPosition} (${formatSigned(asset.rankChange)})` : "not tracked"}
                </td>
                <td className="border-b px-[18px] py-2.5 font-mono text-[10.5px] text-muted-foreground">{asset.visits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="px-[18px] py-5 text-sm text-muted-foreground">No content assets yet.</p>
      )}
    </section>
  );
}

function ChannelHealth({ summary }: { summary: DashboardSummary }) {
  const rows = [
    { label: "SEO / content", status: `${summary.contentPerformance.length} assets tracked`, queue: `${summary.publishedAssets} published` },
    { label: "Inbox", status: summary.pendingInboxItems ? "review needed" : "clear", queue: `${summary.pendingInboxItems} pending` },
    { label: "Analytics", status: summary.sourceBreakdown.length ? "ingesting snapshots" : "waiting for data", queue: `${summary.sourceBreakdown.length} sources` },
  ];

  return (
    <section className="overflow-hidden rounded-[10px] border bg-card">
      <div className="flex items-center justify-between border-b px-[18px] py-[14px]">
        <span className="text-[13px] font-medium text-foreground">Channel health</span>
        <span className="font-mono text-[10.5px] text-muted-foreground">server-backed</span>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="grid items-center border-b px-[18px] py-3 last:border-b-0 hover:bg-secondary" style={{ gridTemplateColumns: "28px 1fr auto", gap: 12 }}>
          <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-accent text-[14px] text-black">*</span>
          <span>
            <span className="block text-[12.5px] font-medium text-foreground">{row.label}</span>
            <span className="mt-[3px] block font-mono text-[10.5px] text-muted-foreground">{row.status}</span>
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">{row.queue}</span>
        </div>
      ))}
    </section>
  );
}

function TrafficSources({ sources }: { sources: TrafficSourceBreakdown[] }) {
  return (
    <section className="overflow-hidden rounded-[10px] border bg-card">
      <div className="flex items-center justify-between border-b px-[18px] py-[14px]">
        <span className="text-[13px] font-medium text-foreground">Traffic by source</span>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/analytics">Analytics</Link>
        </Button>
      </div>
      <div className="px-[18px] pb-3.5 pt-1">
        {sources.length ? (
          sources.slice(0, 6).map((source) => (
            <div key={source.sourceType} className="grid items-center gap-2.5 border-b py-[7px] last:border-b-0" style={{ gridTemplateColumns: "90px 1fr 48px" }}>
              <span className="truncate text-[12px] text-foreground">{formatSourceLabel(source.sourceType)}</span>
              <div className="h-[5px] overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-accent" style={{ width: `${source.sharePercent}%`, opacity: 0.25 + source.sharePercent / 140 }} />
              </div>
              <span className="text-right font-mono text-[11px] text-muted-foreground">{source.visits}</span>
            </div>
          ))
        ) : (
          <p className="py-4 text-sm text-muted-foreground">No traffic snapshots yet.</p>
        )}
      </div>
    </section>
  );
}

function AutopilotPanel() {
  const rows = [
    { label: "SEO content", level: "L1", sub: "review first" },
    { label: "Community replies", level: "off", sub: "not implemented yet" },
    { label: "Outreach", level: "off", sub: "not implemented yet" },
  ];

  return (
    <section className="overflow-hidden rounded-[10px] border bg-card">
      <div className="border-b px-[18px] py-3.5">
        <span className="text-[13px] font-medium text-foreground">Autopilot</span>
      </div>
      <div className="flex flex-col gap-3.5 px-[18px] pb-4 pt-3.5">
        {rows.map((row) => (
          <div key={row.label} className="grid items-center gap-3" style={{ gridTemplateColumns: "1fr auto" }}>
            <span>
              <span className="block text-[12.5px] text-foreground">{row.label}</span>
              <span className="mt-[2px] block font-mono text-[10px] text-muted-foreground">{row.sub}</span>
            </span>
            <span className="rounded-[6px] border bg-secondary px-2.5 py-1 font-mono text-[10.5px] text-muted-foreground">{row.level}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

async function loadDashboardData(): Promise<{
  product: Product | null;
  summary: DashboardSummary | null;
  pendingInboxItems: InboxItem[];
  error: string | null;
  authRequired: boolean;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, summary: null, pendingInboxItems: [], error: null, authRequired: false };
    }

    const [summary, pendingInboxItems] = await Promise.all([
      new AnalyticsService(supabase).getDashboardSummary({ productId: product.id }),
      new InboxService(supabase).listItems({ productId: product.id, status: "pending" }),
    ]);

    return { product, summary, pendingInboxItems, error: null, authRequired: false };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, summary: null, pendingInboxItems: [], error: null, authRequired: true };
    }

    if (error instanceof ProductReadError || error instanceof AnalyticsReadError || error instanceof InboxItemReadError) {
      return { product: null, summary: null, pendingInboxItems: [], error: error.message, authRequired: false };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        summary: null,
        pendingInboxItems: [],
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
        authRequired: false,
      };
    }

    throw error;
  }
}

function formatDelta(value: number | null, suffix: string) {
  if (value === null) {
    return "no prior data";
  }

  return `${value >= 0 ? "+" : ""}${value}% ${suffix}`;
}

function formatSigned(value: number | null) {
  if (value === null) {
    return "new";
  }

  if (value === 0) {
    return "flat";
  }

  return `${value > 0 ? "+" : ""}${value}`;
}

function formatRankChange(keyword: KeywordMovement) {
  if (keyword.trend === "new") {
    return "new";
  }

  return formatSigned(keyword.change);
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const hours = Math.max(0, Math.floor(diffMs / (60 * 60 * 1000)));

  if (hours < 1) {
    return "now";
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function sparklineFromTotal(total: number) {
  const normalized = Math.max(total, 1);
  return [0.5, 0.45, 0.55, 0.62, 0.58, 0.72].map((factor) => Math.max(2, Math.round((normalized * factor) % 26)));
}
