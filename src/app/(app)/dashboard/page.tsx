import { ArrowRight, CheckCircle2, FileText, MessageSquare, Pause, Play, ShieldCheck } from "lucide-react";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const weeklyMetrics = [
  { label: "Visits this week", value: "1,284", delta: "+18%", trend: [12, 18, 16, 24, 30, 28, 36] },
  { label: "Articles published", value: "3", delta: "+1", trend: [1, 1, 2, 2, 3, 2, 3] },
  { label: "Community replies", value: "18", delta: "+6", trend: [3, 4, 5, 4, 7, 8, 9] },
  { label: "Inbox pending", value: "7", delta: "-2", trend: [12, 11, 10, 9, 8, 8, 7] },
];

const inboxItems = [
  { type: "article", title: "How to invoice clients in USDC: a freelancer's guide", meta: "1,840 words - high confidence", time: "2h ago" },
  { type: "reply", title: 'r/freelance - "Anyone accepting crypto payments yet?"', meta: "Relevance score 82", time: "4h ago" },
  { type: "article", title: "Crypto invoicing vs traditional invoicing", meta: "Comparison draft - high confidence", time: "6h ago" },
];

const channels = [
  { name: "Content", status: "healthy", queue: "3 ready", meta: "next draft in 2h", icon: FileText },
  { name: "Community", status: "watching", queue: "2 review", meta: "Reddit, HN", icon: MessageSquare },
  { name: "Directories", status: "needs connection", queue: "paused", meta: "ProductHunt", icon: Pause },
];

const sources = [
  { label: "Search", count: 624, width: "100%", tone: "bg-emerald-300" },
  { label: "Community", count: 318, width: "62%", tone: "bg-emerald-400" },
  { label: "Referral", count: 204, width: "40%", tone: "bg-teal-400" },
  { label: "Direct", count: 138, width: "27%", tone: "bg-teal-500" },
];

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar
        title="Dashboard"
        eyebrow="Weekly operating view"
        actions={
          <Button asChild size="sm">
            <a href="/inbox">
              Review inbox
              <ArrowRight data-icon="inline-end" />
            </a>
          </Button>
        }
      />

      <section className="grid gap-4 p-6 md:grid-cols-4">
        {weeklyMetrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="font-mono text-2xl">{metric.value}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Badge variant={metric.delta.startsWith("-") ? "outline" : "success"}>{metric.delta} this week</Badge>
              </div>
              <Sparkline values={metric.trend} />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 px-6 pb-6 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Weekly brief</CardTitle>
            <CardDescription>Insight, not a repeat of the metrics.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-7 text-muted-foreground">
            Search traffic is improving, but community traffic is contributing less than expected. The{" "}
            <span className="text-foreground">usdc invoice generator</span> article is pulling qualified visits and should be followed by a
            comparison article while intent is warm.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Autopilot</CardTitle>
            <CardDescription>Review gates by channel.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <AutopilotRow label="Content" value="Review first" icon={ShieldCheck} />
            <AutopilotRow label="Community" value="Paused" icon={Pause} />
            <AutopilotRow label="Directories" value="Assisted" icon={Play} />
            <p className="border-t pt-3 font-mono text-xs text-muted-foreground">Next safe action: 3 articles ready for review</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 px-6 pb-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Approval inbox</CardTitle>
                <CardDescription>Visible actions for the next review pass.</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href="/inbox">Open all</a>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col">
            {inboxItems.map((item) => (
              <div key={item.title} className="flex items-center gap-3 border-b py-3 last:border-b-0">
                <input type="checkbox" className="size-3 accent-primary" aria-label={`Select ${item.title}`} />
                <Badge variant="secondary">{item.type}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.meta}</p>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{item.time}</span>
                <Button size="sm" variant="outline">Review</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Channel health</CardTitle>
              <CardDescription>Operational status, not traffic volume.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col">
              {channels.map((channel) => (
                <div key={channel.name} className="flex items-center gap-3 border-b py-3 last:border-b-0">
                  <div className="flex size-8 items-center justify-center rounded-md bg-secondary">
                    <channel.icon />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{channel.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{channel.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs">{channel.queue}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{channel.meta}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Traffic sources</CardTitle>
              <CardDescription>Teal ramp by weekly visits.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {sources.map((source) => (
                <div key={source.label} className="grid grid-cols-[90px_1fr_52px] items-center gap-3">
                  <span className="text-sm">{source.label}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className={`h-full rounded-full ${source.tone}`} style={{ width: source.width }} />
                  </div>
                  <span className="text-right font-mono text-xs text-muted-foreground">{source.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 120;
      const y = 26 - ((value - min) / range) * 22;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 120 28" fill="none" aria-hidden="true" className="h-7 w-full">
      <polyline points={points} stroke="hsl(var(--accent))" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AutopilotRow({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CheckCircle2 }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-secondary px-3 py-2">
      <span className="flex items-center gap-2 text-sm">
        <Icon className="text-muted-foreground" />
        {label}
      </span>
      <Badge variant="outline">{value}</Badge>
    </div>
  );
}
