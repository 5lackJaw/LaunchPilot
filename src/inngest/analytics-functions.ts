import { inngest } from "@/inngest/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ingestPlausibleTrafficForProduct,
  isPlausibleAnalyticsConfigured,
} from "@/server/analytics/plausible-ingestion";
import {
  captureWorkflowException,
  logWorkflowEvent,
} from "@/server/observability/workflow-logger";

export const plausibleAnalyticsIngestionWorkflow = inngest.createFunction(
  {
    id: "plausible-analytics-ingestion-workflow",
    triggers: [
      { cron: "0 6 * * 1" },
      { event: "analytics/plausible_ingestion.requested" },
    ],
  },
  async ({ event, step }) => {
    const workflow = "plausible_analytics_ingestion";
    const requestedProductId = getRequestedProductId(event.data);
    const supabase = createSupabaseAdminClient();
    logWorkflowEvent({
      workflow,
      status: "started",
      eventName: event.name,
      productId: requestedProductId ?? undefined,
    });

    try {
      const products = await step.run("load-plausible-products", async () => {
        if (!isPlausibleAnalyticsConfigured()) {
          return [];
        }

        let query = supabase
          .from("products")
          .select("id,url,status")
          .neq("status", "archived")
          .order("created_at", { ascending: false });

        if (requestedProductId) {
          query = query.eq("id", requestedProductId);
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        return data ?? [];
      });

      const results = await step.run("fetch-and-persist-plausible-snapshots", async () => {
        const ingested = [];

        for (const product of products) {
          ingested.push(
            await ingestPlausibleTrafficForProduct({
              supabase,
              product,
              period: "7d",
            }),
          );
        }

        return ingested;
      });

      logWorkflowEvent({
        workflow,
        status: "succeeded",
        eventName: event.name,
        productId: requestedProductId ?? undefined,
        metadata: {
          productCount: products.length,
          ingestedCount: results.filter((result) => result.status === "ingested").length,
          rowsInserted: results.reduce((sum, result) => sum + result.rowsInserted, 0),
          skippedCount: results.filter((result) => result.status === "skipped").length,
          skippedReasons: Array.from(
            new Set(
              results
                .filter((result) => result.status === "skipped")
                .map((result) => result.reason ?? "unknown"),
            ),
          ).join(","),
        },
      });

      return results;
    } catch (error) {
      captureWorkflowException(error, {
        workflow,
        eventName: event.name,
        productId: requestedProductId ?? undefined,
      });
      throw error;
    }
  },
);

function getRequestedProductId(data: unknown) {
  if (!data || typeof data !== "object" || !("productId" in data)) {
    return null;
  }

  const productId = (data as { productId?: unknown }).productId;
  return typeof productId === "string" && productId.length > 0 ? productId : null;
}
