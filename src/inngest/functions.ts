import { inngest } from "@/inngest/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const briefGenerationPlaceholder = inngest.createFunction(
  { id: "brief-generation-placeholder", triggers: [{ event: "brief/generation.requested" }] },
  async ({ event, step }) => {
    await step.run("record-placeholder", async () => {
      return {
        productId: event.data.productId,
        status: "not_implemented",
      };
    });
  },
);

export const productCrawlPlaceholder = inngest.createFunction(
  { id: "product-crawl-placeholder", triggers: [{ event: "product/crawl.requested" }] },
  async ({ event, step }) => {
    const crawlJobId = event.data.crawlJobId as string;
    const supabase = createSupabaseAdminClient();

    await step.run("mark-running", async () => {
      const { error } = await supabase
        .from("crawl_jobs")
        .update({
          status: "running",
          progress_percent: 35,
          steps: [
            { label: "Fetch product URL", status: "completed" },
            { label: "Extract page signals", status: "running" },
            { label: "Prepare brief inputs", status: "pending" },
          ],
        })
        .eq("id", crawlJobId);

      if (error) {
        throw error;
      }
    });

    await step.run("mark-completed-placeholder", async () => {
      const { error } = await supabase
        .from("crawl_jobs")
        .update({
          status: "completed",
          progress_percent: 100,
          steps: [
            { label: "Fetch product URL", status: "completed" },
            { label: "Extract page signals", status: "completed" },
            { label: "Prepare brief inputs", status: "completed" },
          ],
          completed_at: new Date().toISOString(),
        })
        .eq("id", crawlJobId);

      if (error) {
        throw error;
      }
    });
  },
);

export const functions = [briefGenerationPlaceholder, productCrawlPlaceholder];
