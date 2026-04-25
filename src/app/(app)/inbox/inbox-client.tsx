"use client";

import { ArrowRight, Clock3, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InboxItem } from "@/server/schemas/inbox";
import type { Product } from "@/server/schemas/product";

const filters = ["all", "article", "reply", "listing", "outreach", "copy"] as const;

type InboxListItem = {
  id: string;
  type: (typeof filters)[number] extends "all" ? never : Exclude<(typeof filters)[number], "all">;
  title: string;
  preview: string;
  confidence: number | null;
  impact: string;
  reviewTime: string;
  bulkSafe: boolean;
};

export function InboxClient({ items: persistedItems, product }: { items: InboxItem[]; product: Product | null }) {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const items = useMemo(() => persistedItems.map(mapInboxItem), [persistedItems]);
  const highConfidenceIds = useMemo(() => items.filter((item) => item.bulkSafe).map((item) => item.id), [items]);
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
        eyebrow={product ? `Approval queue / ${product.name}` : "Approval queue"}
        actions={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={approveHighConfidence}>
              Approve all high-confidence ({highConfidenceIds.length})
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
          {visibleItems.length ? visibleItems.map((item) => (
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
                      <Badge variant={item.bulkSafe ? "success" : "outline"}>{formatConfidence(item.confidence)}</Badge>
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
                  <Button size="sm" asChild>
                    <Link href={`/inbox/${item.id}`}>
                      Open review
                      <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )) : (
            <Card>
              <CardHeader>
                <CardTitle>No pending items</CardTitle>
                <CardDescription>
                  Generated actions will appear here when content, community, directory, outreach, or positioning workflows create inbox items.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
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
            <p>Approval execution remains server-authoritative. This page now reads persisted inbox items.</p>
            <p>Low-confidence items stay review-gated.</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function mapInboxItem(item: InboxItem): InboxListItem {
  const confidence = item.aiConfidence === null ? null : Math.round(item.aiConfidence * 100);

  return {
    id: item.id,
    type: mapItemType(item.itemType),
    title: item.payload.title ?? humanizeItemType(item.itemType),
    preview: item.payload.preview ?? item.payload.suggestedAction ?? "Review the generated recommendation before taking action.",
    confidence,
    impact: titleCase(item.impactEstimate),
    reviewTime: formatReviewTime(item.reviewTimeEstimateSeconds),
    bulkSafe: item.impactEstimate === "high" && (item.aiConfidence ?? 0) >= 0.88,
  };
}

function mapItemType(itemType: InboxItem["itemType"]): InboxListItem["type"] {
  switch (itemType) {
    case "content_draft":
      return "article";
    case "community_reply":
      return "reply";
    case "directory_package":
      return "listing";
    case "outreach_email":
      return "outreach";
    case "positioning_update":
    case "weekly_recommendation":
      return "copy";
  }
}

function humanizeItemType(itemType: InboxItem["itemType"]) {
  return itemType.replaceAll("_", " ");
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatReviewTime(seconds: number | null) {
  if (seconds === null) {
    return "Review";
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function formatConfidence(confidence: number | null) {
  return confidence === null ? "No confidence score" : `${confidence}% confidence`;
}
