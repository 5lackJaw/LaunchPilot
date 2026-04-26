import { inngest } from "@/inngest/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildCommunityReplyDraft } from "@/server/community/build-reply-draft";
import { buildThreadCandidates } from "@/server/community/build-thread-candidates";
import { marketingBriefSchema } from "@/server/schemas/brief";
import { communityThreadSchema } from "@/server/schemas/community";

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

export const communityReplyGenerationWorkflow = inngest.createFunction(
  { id: "community-reply-generation-workflow", triggers: [{ event: "community_reply/generation.requested" }] },
  async ({ event, step }) => {
    const threadId = event.data.threadId as string;
    const supabase = createSupabaseAdminClient();

    const inputs = await step.run("load-reply-inputs", async () => {
      const threadResult = await supabase
        .from("community_threads")
        .select(
          "id,product_id,platform,thread_url,thread_title,thread_author_handle,relevance_score,pain_signal_score,audience_fit_score,recency_score,reply_draft,promotional_score,status,posted_at,provenance,created_at,updated_at",
        )
        .eq("id", threadId)
        .single();

      if (threadResult.error) {
        throw threadResult.error;
      }

      const thread = communityThreadSchema.parse({
        id: threadResult.data.id,
        productId: threadResult.data.product_id,
        platform: threadResult.data.platform,
        threadUrl: threadResult.data.thread_url,
        threadTitle: threadResult.data.thread_title,
        threadAuthorHandle: threadResult.data.thread_author_handle,
        relevanceScore: Number(threadResult.data.relevance_score),
        painSignalScore: Number(threadResult.data.pain_signal_score),
        audienceFitScore: Number(threadResult.data.audience_fit_score),
        recencyScore: Number(threadResult.data.recency_score),
        replyDraft: threadResult.data.reply_draft,
        promotionalScore: threadResult.data.promotional_score === null ? null : Number(threadResult.data.promotional_score),
        status: threadResult.data.status,
        postedAt: threadResult.data.posted_at,
        provenance: threadResult.data.provenance,
        createdAt: threadResult.data.created_at,
        updatedAt: threadResult.data.updated_at,
      });

      if (!["observed", "drafted", "failed"].includes(thread.status)) {
        throw new Error("Community thread is not eligible for reply generation.");
      }

      const productResult = await supabase.from("products").select("id,name,current_marketing_brief_id").eq("id", thread.productId).single();

      if (productResult.error) {
        throw productResult.error;
      }

      if (!productResult.data.current_marketing_brief_id) {
        throw new Error("A Marketing Brief is required before community reply generation.");
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
        thread,
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

    const draft = await step.run("draft-reply-and-score-guardrails", async () =>
      buildCommunityReplyDraft({
        productName: inputs.product.name,
        brief: inputs.brief,
        thread: inputs.thread,
      }),
    );

    const updated = await step.run("persist-reply-draft", async () => {
      const blocked = draft.promotionalScore > 0.45;
      const { data, error } = await supabase
        .from("community_threads")
        .update({
          reply_draft: draft.body,
          promotional_score: draft.promotionalScore,
          status: blocked ? "blocked" : "pending_review",
          provenance: {
            ...inputs.thread.provenance,
            replyDraft: {
              generator: "deterministic-community-reply-v0",
              generatedAt: new Date().toISOString(),
              rationale: draft.rationale,
              confidence: draft.confidence,
              guardrail: blocked ? "blocked_promotional_risk" : "review_required",
            },
          },
        })
        .eq("id", inputs.thread.id)
        .select("id,product_id,thread_title,platform,thread_url,reply_draft,promotional_score,status")
        .single();

      if (error) {
        throw error;
      }

      return data;
    });

    if (updated.status === "blocked") {
      return updated;
    }

    await step.run("create-community-reply-inbox-item", async () => {
      const existing = await supabase
        .from("inbox_items")
        .select("id")
        .eq("product_id", updated.product_id)
        .eq("source_entity_type", "community_thread")
        .eq("source_entity_id", updated.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existing.error) {
        throw existing.error;
      }

      if (existing.data) {
        return existing.data;
      }

      const itemResult = await supabase
        .from("inbox_items")
        .insert({
          product_id: updated.product_id,
          item_type: "community_reply",
          source_entity_type: "community_thread",
          source_entity_id: updated.id,
          payload: {
            title: updated.thread_title,
            preview: `Helpful ${updated.platform.replace("_", " ")} reply draft. Promotional score ${Math.round(Number(updated.promotional_score) * 100)}%.`,
            body: updated.reply_draft,
            platform: updated.platform,
            threadUrl: updated.thread_url,
            promotionalScore: Number(updated.promotional_score),
            suggestedAction: "Review the reply before posting.",
            metadata: {
              platform: updated.platform,
              threadUrl: updated.thread_url,
              promotionalScore: Number(updated.promotional_score),
            },
          },
          ai_confidence: draft.confidence,
          impact_estimate: "medium",
          review_time_estimate_seconds: 180,
        })
        .select("id,product_id")
        .single();

      if (itemResult.error) {
        throw itemResult.error;
      }

      const eventResult = await supabase.from("inbox_item_events").insert({
        inbox_item_id: itemResult.data.id,
        product_id: itemResult.data.product_id,
        event_type: "created",
        metadata: { sourceEntityType: "community_thread", sourceEntityId: updated.id, workflow: "community_reply_generation" },
      });

      if (eventResult.error) {
        throw eventResult.error;
      }

      return itemResult.data;
    });

    return updated;
  },
);
