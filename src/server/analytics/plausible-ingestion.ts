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

  const rows = await fetchPlausibleSourceBreakdown({
    siteId,
    apiKey,
    period,
  });
  const recordedAt = new Date().toISOString();
  const ingestionKey = `plausible:${siteId}:source:${period}:${recordedAt.slice(0, 10)}`;

  const deleteResult = await input.supabase
    .from("traffic_snapshots")
    .delete()
    .eq("product_id", input.product.id)
    .contains("provenance", { ingestionKey });

  if (deleteResult.error) {
    throw new PlausibleIngestionError(deleteResult.error.message);
  }

  if (!rows.length) {
    return {
      productId: input.product.id,
      siteId,
      status: "ingested",
      rowsInserted: 0,
    };
  }

  const insertResult = await input.supabase.from("traffic_snapshots").insert(
    rows.map((row) => ({
      product_id: input.product.id,
      source_type: normalizeSourceType(row.source),
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
        ingestionKey,
        sourceLabel: row.source,
        fetchedAt: recordedAt,
      },
    })),
  );

  if (insertResult.error) {
    throw new PlausibleIngestionError(insertResult.error.message);
  }

  return {
    productId: input.product.id,
    siteId,
    status: "ingested",
    rowsInserted: rows.length,
  };
}

async function fetchPlausibleSourceBreakdown(input: {
  siteId: string;
  apiKey: string;
  period: "7d" | "30d";
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
      dimensions: ["visit:source"],
      order_by: [["visitors", "desc"]],
      pagination: { limit: 25, offset: 0 },
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
      source: row.dimensions[0] ?? "Direct / None",
      visitors: Math.max(0, Math.round(row.metrics[0] ?? 0)),
    }))
    .filter((row) => row.visitors > 0);
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
