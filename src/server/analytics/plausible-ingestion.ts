import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { env } from "@/config/env";

const plausibleQueryResponseSchema = z.object({
  results: z.array(
    z.object({
      dimensions: z.array(z.string().nullable()),
      metrics: z.array(z.number()),
    }),
  ),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type PlausibleIngestionResult = {
  productId: string;
  siteId: string;
  status: "ingested" | "skipped";
  rowsInserted: number;
  reason?: string;
};

type ProductAnalyticsTarget = {
  id: string;
  url: string;
};

export function isPlausibleAnalyticsConfigured() {
  return Boolean(env.PLAUSIBLE_SITE_ID && env.PLAUSIBLE_API_KEY);
}

export async function ingestPlausibleTrafficForProduct(input: {
  supabase: SupabaseClient;
  product: ProductAnalyticsTarget;
  period?: "7d" | "30d";
}): Promise<PlausibleIngestionResult> {
  const siteId = env.PLAUSIBLE_SITE_ID;
  const apiKey = env.PLAUSIBLE_API_KEY;
  const period = input.period ?? "7d";

  if (!siteId || !apiKey) {
    return {
      productId: input.product.id,
      siteId: siteId ?? "",
      status: "skipped",
      rowsInserted: 0,
      reason: "plausible_not_configured",
    };
  }

  const configuredHost = normalizeSiteHost(siteId);
  const productHost = normalizeSiteHost(input.product.url);

  if (configuredHost !== productHost) {
    return {
      productId: input.product.id,
      siteId,
      status: "skipped",
      rowsInserted: 0,
      reason: "site_id_does_not_match_product_url",
    };
  }

  const [sourceRows, contentRows] = await Promise.all([
    fetchPlausibleBreakdown({
      siteId,
      apiKey,
      period,
      dimension: "visit:source",
    }),
    fetchPlausibleBreakdown({
      siteId,
      apiKey,
      period,
      dimension: "event:page",
    }),
  ]);
  const contentAssets = await listPublishedContentAssets(input.supabase, input.product.id);
  const contentAssetByPath = new Map(
    contentAssets.flatMap((asset) =>
      getAssetPathnames(asset.published_url).map((pathname) => [pathname, asset] as const),
    ),
  );
  const recordedAt = new Date().toISOString();
  const sourceIngestionKey = `plausible:${siteId}:source:${period}:${recordedAt.slice(0, 10)}`;
  const contentIngestionKey = `plausible:${siteId}:content:${period}:${recordedAt.slice(0, 10)}`;

  await deleteExistingIngestionRows(input.supabase, input.product.id, sourceIngestionKey);
  await deleteExistingIngestionRows(input.supabase, input.product.id, contentIngestionKey);

  const sourceSnapshots = sourceRows.map((row) => ({
    product_id: input.product.id,
    source_type: normalizeSourceType(row.dimensionValue),
    visits: row.visitors,
    conversions: 0,
    recorded_at: recordedAt,
    provenance: {
      provider: "plausible",
      endpoint: "/api/v2/query",
      siteId,
      period,
      dimension: "visit:source",
      metric: "visitors",
      ingestionKey: sourceIngestionKey,
      sourceLabel: row.dimensionValue,
      fetchedAt: recordedAt,
    },
  }));
  const contentSnapshots = contentRows.flatMap((row) => {
    const pathnames = getPagePathnames(row.dimensionValue);
    const assetEntry = pathnames
      .map((pathname) => ({ pathname, asset: contentAssetByPath.get(pathname) }))
      .find((entry) => entry.asset);

    if (!assetEntry?.asset) {
      return [];
    }

    return [
      {
        product_id: input.product.id,
        source_type: "content",
        visits: row.visitors,
        conversions: 0,
        recorded_at: recordedAt,
        provenance: {
          provider: "plausible",
          endpoint: "/api/v2/query",
          siteId,
          period,
          dimension: "event:page",
          metric: "visitors",
          ingestionKey: contentIngestionKey,
          pagePath: assetEntry.pathname,
          contentAssetId: assetEntry.asset.id,
          contentAssetTitle: assetEntry.asset.title,
          fetchedAt: recordedAt,
        },
      },
    ];
  });
  const snapshots = [...sourceSnapshots, ...contentSnapshots];

  if (!snapshots.length) {
    return {
      productId: input.product.id,
      siteId,
      status: "ingested",
      rowsInserted: 0,
    };
  }

  const insertResult = await input.supabase.from("traffic_snapshots").insert(snapshots);

  if (insertResult.error) {
    throw new PlausibleIngestionError(insertResult.error.message);
  }

  return {
    productId: input.product.id,
    siteId,
    status: "ingested",
    rowsInserted: snapshots.length,
  };
}

async function fetchPlausibleBreakdown(input: {
  siteId: string;
  apiKey: string;
  period: "7d" | "30d";
  dimension: "visit:source" | "event:page";
}) {
  const response = await fetch("https://plausible.io/api/v2/query", {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      site_id: input.siteId,
      metrics: ["visitors"],
      date_range: input.period,
      dimensions: [input.dimension],
      order_by: [["visitors", "desc"]],
      pagination: { limit: input.dimension === "event:page" ? 100 : 25, offset: 0 },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new PlausibleIngestionError(
      `Plausible API request failed with HTTP ${response.status}: ${message.slice(0, 300)}`,
    );
  }

  const parsed = plausibleQueryResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new PlausibleIngestionError(
      `Plausible API response did not match the expected schema: ${parsed.error.message}`,
    );
  }

  return parsed.data.results
    .map((row) => ({
      dimensionValue: row.dimensions[0] ?? "Direct / None",
      visitors: Math.max(0, Math.round(row.metrics[0] ?? 0)),
    }))
    .filter((row) => row.visitors > 0);
}

async function listPublishedContentAssets(supabase: SupabaseClient, productId: string) {
  const { data, error } = await supabase
    .from("content_assets")
    .select("id,title,published_url")
    .eq("product_id", productId)
    .eq("status", "published")
    .not("published_url", "is", null);

  if (error) {
    throw new PlausibleIngestionError(error.message);
  }

  return (data ?? []).filter((asset): asset is { id: string; title: string; published_url: string } =>
    Boolean(asset.published_url),
  );
}

async function deleteExistingIngestionRows(
  supabase: SupabaseClient,
  productId: string,
  ingestionKey: string,
) {
  const deleteResult = await supabase
    .from("traffic_snapshots")
    .delete()
    .eq("product_id", productId)
    .contains("provenance", { ingestionKey });

  if (deleteResult.error) {
    throw new PlausibleIngestionError(deleteResult.error.message);
  }
}

function getAssetPathnames(value: string) {
  try {
    return getPagePathnames(new URL(value).pathname);
  } catch {
    return getPagePathnames(value);
  }
}

function getPagePathnames(value: string) {
  const pathname = value.trim().split("?")[0]?.replace(/\/+$/, "") || "/";
  return pathname === "/" ? ["/"] : [pathname, `${pathname}/`];
}

function normalizeSiteHost(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");

  try {
    return normalizeHostname(new URL(trimmed).hostname);
  } catch {
    return normalizeHostname(trimmed.split("/")[0] ?? trimmed);
  }
}

function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/^www\./, "");
}

function normalizeSourceType(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "direct";
}

export class PlausibleIngestionError extends Error {
  constructor(message: string) {
    super(`Plausible analytics ingestion failed: ${message}`);
    this.name = "PlausibleIngestionError";
  }
}
