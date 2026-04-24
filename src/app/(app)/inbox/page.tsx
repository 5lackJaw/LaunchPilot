import { ArrowRight, Clock3, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const items = [
  {
    type: "Content draft",
    title: "Comparison guide for launch analytics tools",
    preview: "Draft explains tradeoffs for founders choosing lightweight analytics.",
    confidence: "82%",
    impact: "High",
    reviewTime: "8 min",
  },
  {
    type: "Community reply",
    title: "Helpful reply in r/SaaS thread",
    preview: "Non-promotional answer about getting first qualified traffic.",
    confidence: "76%",
    impact: "Medium",
    reviewTime: "3 min",
  },
  {
    type: "Directory package",
    title: "BetaList submission package",
    preview: "Listing copy, short tagline, screenshots checklist, and launch notes.",
    confidence: "88%",
    impact: "Medium",
    reviewTime: "5 min",
  },
];

export default function InboxPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Approval queue</p>
          <h1 className="font-serif text-2xl italic text-foreground">Inbox</h1>
        </div>
        <Badge variant="warning">{items.length} pending</Badge>
      </header>

      <section className="grid gap-4 p-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.title}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{item.type}</Badge>
                      <Badge variant="outline">Confidence {item.confidence}</Badge>
                      <Badge variant="outline">{item.impact} impact</Badge>
                    </div>
                    <CardTitle className="truncate text-base">{item.title}</CardTitle>
                    <CardDescription>{item.preview}</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" aria-label={`More actions for ${item.title}`}>
                    <MoreHorizontal />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <Clock3 />
                  {item.reviewTime} review
                </span>
                <Button size="sm">
                  Open review
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Review policy</CardTitle>
            <CardDescription>
              Approval actions are intentionally not wired in Phase 0. The next inbox slice will add durable state and audit trails.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>Low-confidence items must remain review-gated.</p>
            <p>Publishing and sending decisions stay server-authoritative.</p>
            <p>Every approve, reject, or skip action will produce an audit event.</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
