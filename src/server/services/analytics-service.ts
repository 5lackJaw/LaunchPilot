import type { SupabaseClient } from "@supabase/supabase-js";
import { dashboardSummarySchema, listAnalyticsSchema } from "@/server/schemas/analytics";
import type { ContentPerformance, DashboardSummary, KeywordMovement, TrafficSourceBreakdown } from "@/server/schemas/analytics";
import { ProductService } from "@/server/services/product-service";

const dayMs = 24 * 60 * 60 * 1000;

type TrafficRow = {
  source_type: string;
  visits: number | string;
  conversions: number | string;
  recorded_at: string;
};

type KeywordRankRow = {
  keyword: string;
  rank_position: number | string;
  source: string;
  recorded_at: string;
};

type ContentAssetRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  target_keyword: string | null;
  published_url: string | null;
  created_at: string;
  updated_at: string;
};

type InboxRow = {
  review_time_estimate_seconds: number | null;
};

export class AnalyticsService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getDashboardSummary(input: unknown): Promise<DashboardSummary> {
    const parsed = listAnalyticsSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId: parsed.productId });

    const periods = getRollingPeriods(new Date());

    const [currentTraffic, previousTraffic, traffic30d, rankRows, contentRows, pendingInboxRows] = await Promise.all([
      this.listTrafficRows(parsed.productId, periods.current.startsAt),
      this.listTrafficRows(parsed.productId, periods.previous.startsAt, periods.current.startsAt),
      this.listTrafficRows(parsed.productId, new Date(Date.now() - 30 * dayMs).toISOString()),
      this.listKeywordRows(parsed.productId),
      this.listContentRows(parsed.productId),
      this.listPendingInboxRows(parsed.productId),
    ]);

    const visitors = sumTraffic(currentTraffic, "visits");
    const previousVisitors = sumTraffic(previousTraffic, "visits");
    const conversions = sumTraffic(currentTraffic, "conversions");
    const previousConversions = sumTraffic(previousTraffic, "conversions");
    const keywordMovement = deriveKeywordMovement(rankRows);
    const contentPerformance = deriveContentPerformance(contentRows, keywordMovement);
    const publishedAssets = countPublishedAssets(contentRows, periods.current.startsAt);
    const previousPublishedAssets = countPublishedAssets(contentRows, periods.previous.startsAt, periods.current.startsAt);

    return dashboardSummarySchema.parse({
      productId: parsed.productId,
      currentPeriod: periods.current,
      previousPeriod: periods.previous,
      visitors,
      visitorDeltaPercent: percentDelta(visitors, previousVisitors),
      conversions,
      conversionDeltaPercent: percentDelta(conversions, previousConversions),
      publishedAssets,
      publishedAssetDelta: publishedAssets - previousPublishedAssets,
      pendingInboxItems: pendingInboxRows.length,
      estimatedReviewMinutes: Math.ceil(
        pendingInboxRows.reduce((total, row) => total + (row.review_time_estimate_seconds ?? 0), 0) / 60,
      ),
      sourceBreakdown: deriveSourceBreakdown(traffic30d),
      keywordMovement,
      contentPerformance,
      weeklyInsight: deriveWeeklyInsight({
        visitors,
        previousVisitors,
        sourceBreakdown: deriveSourceBreakdown(currentTraffic),
        keywordMovement,
        pendingInboxItems: pendingInboxRows.length,
      }),
    });
  }

  private async listTrafficRows(productId: string, startsAt: string, endsBefore?: string) {
    let query = this.supabase
      .from("traffic_snapshots")
      .select("source_type,visits,conversions,recorded_at")
      .eq("product_id", productId)
      .gte("recorded_at", startsAt)
      .order("recorded_at", { ascending: false });

    if (endsBefore) {
      query = query.lt("recorded_at", endsBefore);
    }

    const { data, error } = await query;

    if (error) {
      throw new AnalyticsReadError(error.message);
    }

    return (data ?? []) as TrafficRow[];
  }

  private async listKeywordRows(productId: string) {
    const { data, error } = await this.supabase
      .from("keyword_rank_snapshots")
      .select("keyword,rank_position,source,recorded_at")
      .eq("product_id", productId)
      .order("recorded_at", { ascending: false })
      .limit(300);

    if (error) {
      throw new AnalyticsReadError(error.message);
    }

    return (data ?? []) as KeywordRankRow[];
  }

  private async listContentRows(productId: string) {
    const { data, error } = await this.supabase
      .from("content_assets")
      .select("id,title,type,status,target_keyword,published_url,created_at,updated_at")
      .eq("product_id", productId)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      throw new AnalyticsReadError(error.message);
    }

    return (data ?? []) as ContentAssetRow[];
  }

  private async listPendingInboxRows(productId: string) {
    const { data, error } = await this.supabase
      .from("inbox_items")
      .select("review_time_estimate_seconds")
      .eq("product_id", productId)
      .eq("status", "pending");

    if (error) {
      throw new AnalyticsReadError(error.message);
    }

    return (data ?? []) as InboxRow[];
  }
}

export class AnalyticsReadError extends Error {
  constructor(message: string) {
    super(`Analytics could not be loaded: ${message}`);
    this.name = "AnalyticsReadError";
  }
}

function getRollingPeriods(now: Date) {
  const currentStart = new Date(now.getTime() - 7 * dayMs);
  const previousStart = new Date(now.getTime() - 14 * dayMs);

  return {
    current: {
      startsAt: currentStart.toISOString(),
      endsAt: now.toISOString(),
      label: formatPeriodLabel(currentStart, now),
    },
    previous: {
      startsAt: previousStart.toISOString(),
      endsAt: currentStart.toISOString(),
      label: formatPeriodLabel(previousStart, currentStart),
    },
  };
}

function formatPeriodLabel(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}-${endsAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function sumTraffic(rows: TrafficRow[], field: "visits" | "conversions") {
  return rows.reduce((total, row) => total + Number(row[field]), 0);
}

function percentDelta(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? null : 100;
  }

  return Math.round(((current - previous) / previous) * 100);
}

function deriveSourceBreakdown(rows: TrafficRow[]): TrafficSourceBreakdown[] {
  const bySource = new Map<string, { visits: number; conversions: number }>();

  rows.forEach((row) => {
    const current = bySource.get(row.source_type) ?? { visits: 0, conversions: 0 };
    current.visits += Number(row.visits);
    current.conversions += Number(row.conversions);
    bySource.set(row.source_type, current);
  });

  const totalVisits = Array.from(bySource.values()).reduce((total, source) => total + source.visits, 0);

  return Array.from(bySource.entries())
    .map(([sourceType, source]) => ({
      sourceType,
      visits: source.visits,
      conversions: source.conversions,
      sharePercent: totalVisits === 0 ? 0 : Math.round((source.visits / totalVisits) * 100),
    }))
    .sort((a, b) => b.visits - a.visits);
}

function deriveKeywordMovement(rows: KeywordRankRow[]): KeywordMovement[] {
  const byKeyword = new Map<string, KeywordRankRow[]>();

  rows.forEach((row) => {
    const key = normalizeKeyword(row.keyword);
    const keywordRows = byKeyword.get(key) ?? [];
    keywordRows.push(row);
    byKeyword.set(key, keywordRows);
  });

  return Array.from(byKeyword.values())
    .map((keywordRows) => {
      const [current, previous] = keywordRows;
      const currentPosition = Number(current.rank_position);
      const previousPosition = previous ? Number(previous.rank_position) : null;
      const change = previousPosition === null ? null : previousPosition - currentPosition;

      const trend: KeywordMovement["trend"] = change === null ? "new" : change > 0 ? "up" : change < 0 ? "down" : "flat";

      return {
        keyword: current.keyword,
        currentPosition,
        previousPosition,
        change,
        trend,
        source: current.source,
        recordedAt: current.recorded_at,
      };
    })
    .sort((a, b) => a.currentPosition - b.currentPosition)
    .slice(0, 12);
}

function deriveContentPerformance(rows: ContentAssetRow[], keywordMovement: KeywordMovement[]): ContentPerformance[] {
  const movementByKeyword = new Map(keywordMovement.map((movement) => [normalizeKeyword(movement.keyword), movement]));

  return rows.slice(0, 12).map((row) => {
    const movement = row.target_keyword ? movementByKeyword.get(normalizeKeyword(row.target_keyword)) : undefined;

    return {
      id: row.id,
      title: row.title,
      type: row.type,
      status: row.status,
      targetKeyword: row.target_keyword,
      publishedUrl: row.published_url,
      visits: 0,
      conversions: 0,
      currentPosition: movement?.currentPosition ?? null,
      rankChange: movement?.change ?? null,
      createdAt: row.created_at,
    };
  });
}

function countPublishedAssets(rows: ContentAssetRow[], startsAt: string, endsBefore?: string) {
  const start = new Date(startsAt).getTime();
  const end = endsBefore ? new Date(endsBefore).getTime() : Number.POSITIVE_INFINITY;

  return rows.filter((row) => {
    const updatedAt = new Date(row.updated_at).getTime();
    return row.status === "published" && updatedAt >= start && updatedAt < end;
  }).length;
}

function deriveWeeklyInsight(input: {
  visitors: number;
  previousVisitors: number;
  sourceBreakdown: TrafficSourceBreakdown[];
  keywordMovement: KeywordMovement[];
  pendingInboxItems: number;
}) {
  if (input.visitors === 0 && input.keywordMovement.length === 0) {
    return {
      title: "Analytics ingestion is ready.",
      body: "Connect traffic and rank sources when integration work begins. Until then, the dashboard will show durable content and inbox state plus empty analytics baselines.",
      actionLabel: null,
    };
  }

  const leadingSource = input.sourceBreakdown[0];
  const leadingKeyword = input.keywordMovement.find((movement) => movement.trend === "up") ?? input.keywordMovement[0];

  if (leadingSource) {
    return {
      title: `${formatSourceLabel(leadingSource.sourceType)} is the strongest source this period.`,
      body: `${formatSourceLabel(leadingSource.sourceType)} contributed ${leadingSource.visits.toLocaleString()} visits. ${
        leadingKeyword
          ? `${leadingKeyword.keyword} is currently at position #${leadingKeyword.currentPosition}; use it to choose the next content update.`
          : "Add keyword snapshots to connect traffic movement with SEO changes."
      }`,
      actionLabel: input.pendingInboxItems > 0 ? "Review pending actions" : null,
    };
  }

  return {
    title: "Keyword tracking has started.",
    body: `${leadingKeyword.keyword} is currently at position #${leadingKeyword.currentPosition}. Add traffic snapshots to see whether movement is producing visits.`,
    actionLabel: input.pendingInboxItems > 0 ? "Review pending actions" : null,
  };
}

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase();
}

export function formatSourceLabel(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bSeo\b/g, "SEO")
    .replace(/\bHn\b/g, "HN");
}
