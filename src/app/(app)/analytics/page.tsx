import { Download, Plus } from "lucide-react";
import Link from "next/link";
import { AppTopbar, RangeTabs } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
      <main className="min-h-screen bg-background">
        <AppTopbar title="Analytics" />
        <div className="p-6">
          <EmptyState
            icon={Download}
            title="No product available"
            description="Create a product during onboarding before analytics can be shown."
          />
        </div>
      </main>
    );
  }

  const summary = data.summary;

  return (
    <main className="min-h-screen bg-background">
      <AppTopbar
        title="Analytics"
        eyebrow={`Traffic and performance / ${data.product.name}`}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download />
              Export CSV
            </Button>
            <Button variant="outline" size="sm">
              <Plus />
              Add goal
            </Button>
          </>
        }
      />
      <RangeTabs active="30d" />

      <div className="space-y-5 px-6 py-5">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Total visitors" value={summary.visitors.toLocaleString()} delta={formatDelta(summary.visitorDeltaPercent)} />
          <KpiCard label="Conversions" value={summary.conversions.toLocaleString()} delta={formatDelta(summary.conversionDeltaPercent)} />
          <KpiCard label="Sources tracked" value={String(summary.sourceBreakdown.length)} delta="30 day window" neutral />
          <KpiCard label="Keywords tracked" value={String(summary.keywordMovement.length)} delta="latest snapshots" neutral />
          <KpiCard label="Inbox pending" value={String(summary.pendingInboxItems)} delta={`${summary.estimatedReviewMinutes} min review`} neutral />
        </section>

        <section className="flex flex-col gap-4 rounded-lg border bg-secondary/40 p-4 md:flex-row md:items-start">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">i</div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium">This week&apos;s recommendation</h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">{summary.weeklyInsight.body}</p>
            {summary.weeklyInsight.actionLabel ? (
              <div className="mt-3">
                <Button size="sm" asChild>
                  <Link href="/inbox">{summary.weeklyInsight.actionLabel}</Link>
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <Card className="rounded-lg">
          <CardHeader className="flex-row items-center justify-between gap-4 border-b p-4">
            <CardTitle className="text-sm font-medium">Visitors by source</CardTitle>
            <span className="font-mono text-[10px] text-muted-foreground">{summary.currentPeriod.label}</span>
          </CardHeader>
          <CardContent className="p-4">
            <svg viewBox="0 0 620 180" role="img" aria-label="Visitors by source chart" className="h-56 w-full overflow-visible">
              {[35, 70, 105, 140].map((y) => (
                <line key={y} x1="42" x2="592" y1={y} y2={y} stroke="hsl(var(--border))" strokeWidth="1" />
              ))}
              {chartPoints(summary.sourceBreakdown.map((source) => source.visits)).map((point, index, points) => {
                const [x, y] = point;
                const previous = points[index - 1];
                return (
                  <g key={`${x}-${y}`}>
                    {previous ? <line x1={previous[0]} y1={previous[1]} x2={x} y2={y} stroke="hsl(var(--accent))" strokeWidth="3" strokeLinecap="round" /> : null}
                    <circle cx={x} cy={y} r="3" fill="hsl(var(--accent))" />
                  </g>
                );
              })}
              <text x="42" y="172" fill="hsl(var(--muted-foreground))" fontSize="10" fontFamily="var(--font-mono)">
                lowest
              </text>
              <text x="520" y="172" fill="hsl(var(--muted-foreground))" fontSize="10" fontFamily="var(--font-mono)">
                highest
              </text>
            </svg>
          </CardContent>
        </Card>

        <section className="grid gap-4 xl:grid-cols-3">
          <TrafficSources summary={summary} />
          <TopContent summary={summary} />
          <KeywordMovementPanel keywords={summary.keywordMovement} />
        </section>
      </div>
    </main>
  );
}

function AnalyticsShell({ errorTitle, error, destructive }: { errorTitle: string; error: string; destructive?: boolean }) {
  return (
    <main className="min-h-screen bg-background">
      <AppTopbar title="Analytics" />
      <div className="p-6">
        <Alert variant={destructive ? "destructive" : "default"}>
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    </main>
  );
}

function KpiCard({ label, value, delta, neutral }: { label: string; value: string; delta: string; neutral?: boolean }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <div className="mt-2 font-serif text-3xl font-normal leading-none">{value}</div>
        <p className={neutral ? "mt-2 font-mono text-[10px] text-muted-foreground" : delta.startsWith("-") ? "mt-2 font-mono text-[10px] text-red-300" : "mt-2 font-mono text-[10px] text-emerald-300"}>{delta}</p>
      </CardContent>
    </Card>
  );
}

function TrafficSources({ summary }: { summary: DashboardSummary }) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="flex-row items-center justify-between border-b p-4">
        <CardTitle className="text-sm font-medium">Traffic sources</CardTitle>
        <span className="font-mono text-[10px] text-muted-foreground">last 30 days</span>
      </CardHeader>
      <CardContent className="p-0">
        {summary.sourceBreakdown.length ? (
          <table className="w-full">
            <thead>
              <tr className="border-b font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                <th className="px-4 py-2 text-left font-normal">Source</th>
                <th className="px-4 py-2 text-left font-normal">Share</th>
                <th className="px-4 py-2 text-right font-normal">Visits</th>
                <th className="px-4 py-2 text-right font-normal">Conv.</th>
              </tr>
            </thead>
            <tbody>
              {summary.sourceBreakdown.map((source) => (
                <tr key={source.sourceType} className="border-b last:border-0 hover:bg-secondary/60">
                  <td className="px-4 py-3 text-xs font-medium">{formatSourceLabel(source.sourceType)}</td>
                  <td className="px-4 py-3">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-300" style={{ width: `${source.sharePercent}%`, opacity: 0.25 + source.sharePercent / 140 }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{source.visits}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{source.conversions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-4">
            <EmptyState
              title="No traffic snapshots yet"
              description="Traffic source rows will appear after analytics snapshots are ingested for the current product."
              className="border-dashed"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopContent({ summary }: { summary: DashboardSummary }) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="flex-row items-center justify-between border-b p-4">
        <CardTitle className="text-sm font-medium">Top content</CardTitle>
        <span className="font-mono text-[10px] text-muted-foreground">asset status</span>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {summary.contentPerformance.length ? (
          summary.contentPerformance.slice(0, 6).map((row, index) => (
            <div key={row.id} className="grid grid-cols-[20px_minmax(0,1fr)_auto] gap-3 px-4 py-3 hover:bg-secondary/60">
              <span className="font-mono text-[10px] text-muted-foreground">{index + 1}</span>
              <div className="min-w-0">
                <Link href={`/content/${row.id}`} className="block truncate text-xs font-medium hover:text-primary">
                  {row.title}
                </Link>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {row.type} / {row.targetKeyword ?? "no keyword"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs">{row.status}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{row.currentPosition ? `#${row.currentPosition}` : "unranked"}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4">
            <EmptyState
              title="No content assets yet"
              description="Content performance will appear after generated assets have measurable activity."
              className="border-dashed"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KeywordMovementPanel({ keywords }: { keywords: KeywordMovement[] }) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="flex-row items-center justify-between border-b p-4">
        <CardTitle className="text-sm font-medium">Keyword movement</CardTitle>
        <span className="font-mono text-[10px] text-muted-foreground">latest rank</span>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {keywords.length ? (
          keywords.slice(0, 6).map((keyword) => (
            <div key={keyword.keyword} className="space-y-1.5 border-b pb-3 last:border-b-0 last:pb-0">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate">{keyword.keyword}</span>
                <span className="font-mono text-muted-foreground">#{keyword.currentPosition}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-300" style={{ width: `${Math.max(5, 100 - keyword.currentPosition)}%` }} />
              </div>
              <p className={keyword.trend === "up" ? "text-right font-mono text-[10px] text-emerald-300" : keyword.trend === "down" ? "text-right font-mono text-[10px] text-red-300" : "text-right font-mono text-[10px] text-muted-foreground"}>
                {keyword.trend === "new" ? "new" : keyword.change === 0 ? "flat" : `${keyword.change && keyword.change > 0 ? "+" : ""}${keyword.change} ranks`}
              </p>
            </div>
          ))
        ) : (
          <EmptyState
            title="No rank snapshots yet"
            description="Keyword movement will appear after rank snapshots are ingested for the current product."
            className="border-dashed"
          />
        )}
      </CardContent>
    </Card>
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

function chartPoints(values: number[]) {
  const chartValues = values.length ? values : [0, 0, 0, 0, 0, 0];
  const max = Math.max(...chartValues, 1);
  const step = 500 / Math.max(chartValues.length - 1, 1);

  return chartValues.map((value, index) => [80 + index * step, 150 - (value / max) * 110] as const);
}
