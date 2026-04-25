import { inngest } from "@/inngest/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildThreadCandidates } from "@/server/community/build-thread-candidates";
import { marketingBriefSchema } from "@/server/schemas/brief";

export const communityThreadIngestionWorkflow = inngest.createFunction(
  { id: "community-thread-ingestion-workflow", triggers: [{ event: "community_threads/ingestion.requested" }] },
  async ({ event, step }) => {
    const productId = event.data.productId as string;
    const supabase = createSupabaseAdminClient();

    const inputs = await step.run("load-community-inputs", async () => {
      const productResult = await supabase.from("products").select("id,name,current_marketing_brief_id").eq("id", productId).single();

      if (productResult.error) {
        throw productResult.error;
      }

      if (!productResult.data.current_marketing_brief_id) {
        throw new Error("A Marketing Brief is required before community thread ingestion.");
      }

      const briefResult = await supabase
        .from("marketing_briefs")
        .select(
          "id,product_id,version,tagline,value_props,personas,competitors,keyword_clusters,tone_profile,channels_ranked,content_calendar_seed,launch_date,provenance,created_at,updated_at",
        )
        .eq("id", productResult.data.current_marketing_brief_id)
        .single();

      if (briefResult.error) {
        throw briefResult.error;
      }

      return {
        product: productResult.data,
        brief: marketingBriefSchema.parse({
          id: briefResult.data.id,
          productId: briefResult.data.product_id,
          version: briefResult.data.version,
          tagline: briefResult.data.tagline,
          valueProps: briefResult.data.value_props,
          personas: briefResult.data.personas,
          competitors: briefResult.data.competitors,
          keywordClusters: briefResult.data.keyword_clusters,
          toneProfile: briefResult.data.tone_profile,
          channelsRanked: briefResult.data.channels_ranked,
          contentCalendarSeed: briefResult.data.content_calendar_seed,
          launchDate: briefResult.data.launch_date,
          provenance: briefResult.data.provenance,
          createdAt: briefResult.data.created_at,
          updatedAt: briefResult.data.updated_at,
        }),
      };
    });

    const candidates = await step.run("score-thread-candidates", async () =>
      buildThreadCandidates({
        productName: inputs.product.name,
        brief: inputs.brief,
      }),
    );

    await step.run("persist-observed-threads", async () => {
      const rows = candidates.map((candidate) => ({
        product_id: productId,
        platform: candidate.platform,
        thread_url: candidate.threadUrl,
        thread_title: candidate.threadTitle,
        thread_author_handle: candidate.threadAuthorHandle,
        relevance_score: candidate.relevanceScore,
        pain_signal_score: candidate.painSignalScore,
        audience_fit_score: candidate.audienceFitScore,
        recency_score: candidate.recencyScore,
        provenance: candidate.provenance,
      }));

      const { error } = await supabase
        .from("community_threads")
        .upsert(rows, { onConflict: "product_id,platform,thread_url" });

      if (error) {
        throw error;
      }

      return rows.length;
    });
  },
);
