import { ArrowRight, Download, Lightbulb, Plus } from "lucide-react";
import { AppTopbar, RangeTabs } from "@/components/layout/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const kpis = [
  { label: "Total visitors", value: "1,847", delta: "+34% vs prior period" },
  { label: "Unique visitors", value: "1,203", delta: "+28%" },
  { label: "Avg. time on page", value: "2:41", delta: "+18s" },
  { label: "Bounce rate", value: "51%", delta: "-4pp (better)" },
  { label: "Signups", value: "38", delta: "+12 this period" },
];

const sources = [
  { name: "Organic", visits: "612", share: "33%", delta: "+28%", width: 66, tone: "bg-emerald-300" },
  { name: "Reddit", visits: "340", share: "18%", delta: "+55%", width: 37, tone: "bg-emerald-300/80" },
  { name: "HN", visits: "218", share: "12%", delta: "+12%", width: 24, tone: "bg-emerald-300/60" },
  { name: "Directories", visits: "164", share: "9%", delta: "+8%", width: 18, tone: "bg-emerald-300/50" },
  { name: "Direct", visits: "112", share: "6%", delta: "0%", width: 12, tone: "bg-emerald-300/35" },
  { name: "Other", visits: "47", share: "3%", delta: "-3%", width: 5, tone: "bg-emerald-300/25" },
];

const contentRows = [
  { title: "USDC invoice generator for freelancers", meta: "article", position: "pos #4", views: "284", trend: "+6 ranks", positive: true },
  { title: "How to invoice clients in USDC", meta: "article", position: "pos #14", views: "198", trend: "+3 ranks", positive: true },
  { title: "Crypto invoicing vs traditional invoicing", meta: "comparison", position: "pos #19", views: "142", trend: "-2 ranks", positive: false },
  { title: "Best USDC payment tools 2026", meta: "list post", position: "pos #7", views: "96", trend: "+11 ranks", positive: true },
  { title: "Solana B2B payment guide", meta: "article", position: "pos #31", views: "72", trend: "no change", positive: null },
];

const funnel = [
  { label: "Visitors", count: "1,847", rate: "100%", width: 100, tone: "bg-emerald-300" },
  { label: "Engaged (>30s)", count: "776", rate: "42% of visitors", width: 42, tone: "bg-emerald-300" },
  { label: "Pricing page view", count: "184", rate: "10% of visitors", width: 10, tone: "bg-amber-400" },
  { label: "Signups", count: "38", rate: "2.1% of visitors", width: 2, tone: "bg-primary" },
];

const chartPoints = [
  "108,142",
  "150,126",
  "192,134",
  "234,108",
  "276,118",
  "318,86",
  "360,92",
  "402,74",
  "444,70",
  "486,52",
  "528,58",
  "570,40",
];

export default function AnalyticsPage() {
  return (
    <main className="min-h-screen bg-background">
      <AppTopbar
        title="Analytics"
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
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="rounded-lg">
              <CardContent className="p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{kpi.label}</p>
                <div className="mt-2 font-serif text-3xl font-normal leading-none">{kpi.value}</div>
                <p className="mt-2 font-mono text-[10px] text-emerald-300">{kpi.delta}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="flex flex-col gap-4 rounded-lg border bg-secondary/40 p-4 md:flex-row md:items-start">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Lightbulb />
          </div>
          <div className="min-w-0 flex-1">
              <h2 className="text-sm font-medium">This week&apos;s recommendation</h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
              Reddit is outperforming SEO on a per-post basis: <span className="text-emerald-300">340 visits from 3 posts</span>{" "}
              vs 612 organic from 12 articles. Post 2 more targeted replies this week in r/freelance and r/solana.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm">
                Review threads
                <ArrowRight />
              </Button>
              <Button variant="outline" size="sm">
                Dismiss
              </Button>
            </div>
          </div>
        </section>

        <Card className="rounded-lg">
          <CardHeader className="flex-row items-center justify-between gap-4 border-b p-4">
            <CardTitle className="text-sm font-medium">Visitors over time</CardTitle>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground">
              <Legend color="bg-emerald-300" label="Organic" />
              <Legend color="bg-orange-500" label="Reddit" />
              <Legend color="bg-amber-400" label="Hacker News" />
              <Legend color="bg-primary" label="Directories" />
              <Legend color="bg-muted-foreground" label="Direct" />
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <svg viewBox="0 0 620 180" role="img" aria-label="Visitors over time chart" className="h-56 w-full overflow-visible">
              <defs>
                <linearGradient id="analytics-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.24" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[35, 70, 105, 140].map((y) => (
                <line key={y} x1="42" x2="592" y1={y} y2={y} stroke="hsl(var(--border))" strokeWidth="1" />
              ))}
              <path d={`M ${chartPoints.join(" L ")}`} fill="none" stroke="hsl(var(--accent))" strokeWidth="3" />
              <path d={`M 108,142 L ${chartPoints.slice(1).join(" L ")} L 570,164 L 108,164 Z`} fill="url(#analytics-fill)" />
              {chartPoints.map((point) => {
                const [cx, cy] = point.split(",");
                return <circle key={point} cx={cx} cy={cy} r="3" fill="hsl(var(--accent))" />;
              })}
              <text x="42" y="172" fill="hsl(var(--muted-foreground))" fontSize="10" fontFamily="var(--font-mono)">
                Mar 26
              </text>
              <text x="520" y="172" fill="hsl(var(--muted-foreground))" fontSize="10" fontFamily="var(--font-mono)">
                Apr 24
              </text>
            </svg>
          </CardContent>
        </Card>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="rounded-lg">
            <CardHeader className="flex-row items-center justify-between border-b p-4">
              <CardTitle className="text-sm font-medium">Traffic sources</CardTitle>
              <span className="font-mono text-[10px] text-muted-foreground">last 30 days</span>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                    <th className="px-4 py-2 text-left font-normal">Source</th>
                    <th className="px-4 py-2 text-left font-normal">Share</th>
                    <th className="px-4 py-2 text-right font-normal">Visits</th>
                    <th className="px-4 py-2 text-right font-normal">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr key={source.name} className="border-b last:border-0 hover:bg-secondary/60">
                      <td className="px-4 py-3 text-xs font-medium">{source.name}</td>
                      <td className="px-4 py-3">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full", source.tone)} style={{ width: `${source.width}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{source.visits}</td>
                      <td className={cn("px-4 py-3 text-right font-mono text-[11px]", source.delta.startsWith("-") ? "text-red-300" : "text-emerald-300")}>
                        {source.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader className="flex-row items-center justify-between border-b p-4">
              <CardTitle className="text-sm font-medium">Top content</CardTitle>
              <span className="font-mono text-[10px] text-muted-foreground">by visits</span>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {contentRows.map((row, index) => (
                <div key={row.title} className="grid grid-cols-[20px_minmax(0,1fr)_auto] gap-3 px-4 py-3 hover:bg-secondary/60">
                  <span className="font-mono text-[10px] text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{row.title}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {row.meta} / <span className={row.position.includes("#4") || row.position.includes("#7") ? "text-emerald-300" : ""}>{row.position}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs">{row.views}</p>
                    <p className={cn("font-mono text-[10px]", row.positive === true && "text-emerald-300", row.positive === false && "text-red-300", row.positive === null && "text-muted-foreground")}>
                      {row.trend}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader className="flex-row items-center justify-between border-b p-4">
              <CardTitle className="text-sm font-medium">Conversion funnel</CardTitle>
              <span className="font-mono text-[10px] text-muted-foreground">visitors to signups</span>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {funnel.map((step) => (
                <div key={step.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span>{step.label}</span>
                    <span className="font-mono text-muted-foreground">{step.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", step.tone)} style={{ width: `${step.width}%` }} />
                  </div>
                  <p className="text-right font-mono text-[10px] text-muted-foreground">{step.rate}</p>
                </div>
              ))}
              <div className="border-t pt-3">
                <Badge variant="secondary">Funnel insight</Badge>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Pricing page to signup conversion is strong at <span className="text-emerald-300">20.7%</span>. Biggest drop:
                  visitor to engaged. Focus on above-fold hook copy.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-sm", color)} aria-hidden="true" />
      {label}
    </span>
  );
}
