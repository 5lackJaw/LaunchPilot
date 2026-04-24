import { ArrowRight, CheckCircle2, Clock3, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const metrics = [
  { label: "Visits", value: "1,284", note: "+18% this week" },
  { label: "Inbox", value: "7", note: "needs review" },
  { label: "Published", value: "12", note: "assets live" },
  { label: "Keywords", value: "23", note: "tracked" },
];

const inboxPreview = [
  { type: "Content draft", title: "Comparison guide for launch analytics tools", impact: "High" },
  { type: "Directory package", title: "SaaS launch listing for BetaList", impact: "Medium" },
  { type: "Community reply", title: "Helpful reply in r/SaaS thread", impact: "Medium" },
];

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Weekly summary</p>
          <h1 className="font-serif text-2xl italic text-foreground">Dashboard</h1>
        </div>
        <Button asChild size="sm">
          <a href="/inbox">
            Review inbox
            <ArrowRight data-icon="inline-end" />
          </a>
        </Button>
      </header>

      <section className="grid gap-4 p-6 md:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="font-mono text-2xl">{metric.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{metric.note}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 px-6 pb-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>What needs attention</CardTitle>
            <CardDescription>Items are placeholders until the inbox persistence slice is implemented.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {inboxPreview.map((item) => (
              <div key={item.title} className="flex items-center justify-between rounded-md border bg-secondary p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{item.type}</Badge>
                    <Badge variant="outline">{item.impact}</Badge>
                  </div>
                  <p className="mt-2 truncate text-sm font-medium">{item.title}</p>
                </div>
                <Button asChild variant="ghost" size="icon" aria-label={`Open ${item.title}`}>
                  <a href="/inbox">
                    <ArrowRight />
                  </a>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System posture</CardTitle>
            <CardDescription>Phase 0 scaffolding status.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <StatusLine icon={CheckCircle2} label="App shell" value="Ready" />
            <StatusLine icon={Clock3} label="Auth" value="Supabase scaffold" />
            <StatusLine icon={Clock3} label="Workflows" value="Inngest scaffold" />
            <StatusLine icon={TrendingUp} label="Analytics" value="Pending slice" />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function StatusLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-secondary px-3 py-2">
      <span className="flex items-center gap-2 text-sm">
        <Icon className="text-muted-foreground" />
        {label}
      </span>
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
    </div>
  );
}
