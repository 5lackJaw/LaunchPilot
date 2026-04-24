"use client";

import { ArrowRight, Clock3, MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const items = [
  {
    id: "article-usdc",
    type: "article",
    title: "How to invoice clients in USDC: a freelancer's guide",
    preview: "1,840 words - targets usdc invoice freelancer.",
    confidence: 92,
    impact: "High",
    reviewTime: "8 min",
    bulkSafe: true,
  },
  {
    id: "reply-reddit",
    type: "reply",
    title: 'r/freelance - "Anyone accepting crypto payments yet?"',
    preview: "Reddit reply draft - relevance score 82.",
    confidence: 82,
    impact: "Medium",
    reviewTime: "3 min",
    bulkSafe: false,
  },
  {
    id: "article-comparison",
    type: "article",
    title: "Crypto invoicing vs traditional invoicing: a comparison",
    preview: "Comparison article - targets alternative invoicing tools.",
    confidence: 91,
    impact: "High",
    reviewTime: "9 min",
    bulkSafe: true,
  },
  {
    id: "listing-ph",
    type: "listing",
    title: "ProductHunt launch package - tagline, description, screenshots",
    preview: "Directory package with five generated assets.",
    confidence: 88,
    impact: "High",
    reviewTime: "5 min",
    bulkSafe: true,
  },
  {
    id: "outreach-newsletter",
    type: "outreach",
    title: "Newsletter pitch for indie payments roundup",
    preview: "Cold outreach draft with product-specific hook.",
    confidence: 74,
    impact: "Medium",
    reviewTime: "4 min",
    bulkSafe: false,
  },
];

const filters = ["all", "article", "reply", "listing", "outreach", "copy"] as const;

export function InboxClient() {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const highConfidenceIds = useMemo(() => items.filter((item) => item.bulkSafe).map((item) => item.id), []);
  const visibleItems = activeFilter === "all" ? items : items.filter((item) => item.type === activeFilter);

  function toggleItem(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function approveHighConfidence() {
    setSelected(new Set(highConfidenceIds));
  }

  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar
        title="Inbox"
        eyebrow="Approval queue"
        actions={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={approveHighConfidence}>
              Approve all high-confidence (3)
            </Button>
            <Badge variant="warning">{items.length} pending</Badge>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-6 py-3">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            aria-current={activeFilter === filter ? "true" : undefined}
            className="rounded-full border bg-background px-3 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-current:bg-secondary aria-current:text-foreground"
          >
            {filter} <span className="opacity-60">{filter === "all" ? items.length : items.filter((item) => item.type === filter).length}</span>
          </button>
        ))}
      </div>

      <section className="grid gap-4 p-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          {visibleItems.map((item) => (
            <Card key={item.id} className={selected.has(item.id) ? "border-primary" : undefined}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <input
                    className="mt-1 size-3.5 accent-primary"
                    type="checkbox"
                    aria-label={`Select ${item.title}`}
                    checked={selected.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{item.type}</Badge>
                      <Badge variant={item.bulkSafe ? "success" : "outline"}>{item.confidence}% confidence</Badge>
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
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline">Skip</Button>
                  <Button size="sm">
                    Open review
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bulk selection</CardTitle>
            <CardDescription>
              The high-confidence action marks the three items currently flagged as safe for bulk approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>{selected.size} selected</p>
            <p>Approval execution remains server-authoritative in the inbox backbone slice.</p>
            <p>Low-confidence items stay review-gated.</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
