import { inngest } from "@/inngest/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildInitialBrief } from "@/server/brief/build-initial-brief";
import { buildArticleDraft } from "@/server/content/build-article-draft";
import { extractPageSignals } from "@/server/crawl/extract-page-signals";
import { isWeeklyDigestEmailConfigured, sendWeeklyDigestEmail } from "@/server/email/weekly-digest-email";
import { contentAssetSchema } from "@/server/schemas/content";
import { marketingBriefSchema } from "@/server/schemas/brief";
import { AnalyticsService, buildWeeklyDigest } from "@/server/services/analytics-service";

export const briefGenerationWorkflow = inngest.createFunction(
  { id: "brief-generation-workflow", triggers: [{ event: "brief/generation.requested" }] },
  async ({ event, step }) => {
    const productId = event.data.productId as string;
    const supabase = createSupabaseAdminClient();

    const inputs = await step.run("load-brief-inputs", async () => {
      const [productResult, crawlResult, answersResult, versionResult] = await Promise.all([
        supabase.from("products").select("id,name,url").eq("id", productId).single(),
        supabase
          .from("crawl_results")
          .select("id,page_title,meta_description,h1,extracted_signals,created_at")
          .eq("product_id", productId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("interview_answers").select("question_id,answer").eq("product_id", productId),
        supabase.from("marketing_briefs").select("version").eq("product_id", productId).order("version", { ascending: false }).limit(1),
      ]);

      if (productResult.error) {
        throw productResult.error;
      }

      if (crawlResult.error) {
        throw crawlResult.error;
      }

      if (answersResult.error) {
        throw answersResult.error;
      }

      if (versionResult.error) {
        throw versionResult.error;
      }

      return {
        product: productResult.data,
        crawl: crawlResult.data,
        answers: answersResult.data,
        nextVersion: (versionResult.data[0]?.version ?? 0) + 1,
      };
    });

    const brief = await step.run("compose-brief", async () => buildInitialBrief(inputs));

    const inserted = await step.run("persist-brief-version", async () => {
      const { data, error } = await supabase
        .from("marketing_briefs")
        .insert({
          product_id: productId,
          version: brief.version,
          tagline: brief.tagline,
          value_props: brief.valueProps,
          personas: brief.personas,
          competitors: brief.competitors,
          keyword_clusters: brief.keywordClusters,
          tone_profile: brief.toneProfile,
          channels_ranked: brief.channelsRanked,
          content_calendar_seed: brief.contentCalendarSeed,
          provenance: brief.provenance,
        })
        .select("id,version")
        .single();

      if (error) {
        throw error;
      }

      return data;
    });

    await step.run("mark-current-brief", async () => {
      const { error } = await supabase
        .from("products")
        .update({
          current_marketing_brief_id: inserted.id,
          status: "onboarding",
        })
        .eq("id", productId);

      if (error) {
        throw error;
      }

      return inserted;
    });
  },
);

export const productCrawlPlaceholder = inngest.createFunction(
  { id: "product-crawl-placeholder", triggers: [{ event: "product/crawl.requested" }] },
  async ({ event, step }) => {
    const crawlJobId = event.data.crawlJobId as string;
    const productId = event.data.productId as string;
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

    try {
      const product = await step.run("load-product", async () => {
        const { data, error } = await supabase.from("products").select("id,url").eq("id", productId).single();

        if (error) {
          throw error;
        }

        return data;
      });

      const crawlResult = await step.run("fetch-and-extract-page", async () => {
        const response = await fetch(product.url, {
          headers: {
            "user-agent": "LaunchPilotBot/0.1 (+https://launchpilot.local)",
            accept: "text/html,application/xhtml+xml",
          },
          redirect: "follow",
        });
        const contentType = response.headers.get("content-type") ?? "";
        const html = contentType.includes("text/html") ? await response.text() : "";
        const signals = html ? extractPageSignals(html) : extractPageSignals("");

        const { data, error } = await supabase
          .from("crawl_results")
          .upsert(
            {
              product_id: productId,
              crawl_job_id: crawlJobId,
              source_url: product.url,
              final_url: response.url,
              http_status: response.status,
              page_title: signals.title,
              meta_description: signals.metaDescription,
              h1: signals.h1,
              extracted_signals: {
                headings: signals.headings,
                canonicalUrl: signals.canonicalUrl,
                openGraphTitle: signals.openGraphTitle,
                openGraphDescription: signals.openGraphDescription,
                contentType,
              },
              provenance: {
                crawler: "LaunchPilotBot/0.1",
                fetchedAt: new Date().toISOString(),
              },
            },
            { onConflict: "crawl_job_id" },
          )
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        return data;
      });

      await step.run("mark-completed", async () => {
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

        return crawlResult;
      });
    } catch (error) {
      await step.run("mark-failed", async () => {
        const message = error instanceof Error ? error.message : "Unknown crawl failure.";
        const { error: updateError } = await supabase
          .from("crawl_jobs")
          .update({
            status: "failed",
            progress_percent: 35,
            steps: [
              { label: "Fetch product URL", status: "failed" },
              { label: "Extract page signals", status: "pending" },
              { label: "Prepare brief inputs", status: "pending" },
            ],
            error_message: message.slice(0, 500),
          })
          .eq("id", crawlJobId);

        if (updateError) {
          throw updateError;
        }
      });

      throw error;
    }
  },
);

export const contentGenerationWorkflow = inngest.createFunction(
  { id: "content-generation-workflow", triggers: [{ event: "content/generation.requested" }] },
  async ({ event, step }) => {
    const contentAssetId = event.data.contentAssetId as string;
    const supabase = createSupabaseAdminClient();

    const inputs = await step.run("load-content-inputs", async () => {
      const assetResult = await supabase
        .from("content_assets")
        .select("id,product_id,brief_version,type,title,body_md,target_keyword,meta_title,meta_description,status,published_url,ai_confidence,provenance,created_at,updated_at")
        .eq("id", contentAssetId)
        .single();

      if (assetResult.error) {
        throw assetResult.error;
      }

      const asset = contentAssetSchema.parse({
        id: assetResult.data.id,
        productId: assetResult.data.product_id,
        briefVersion: assetResult.data.brief_version,
        type: assetResult.data.type,
        title: assetResult.data.title,
        bodyMd: assetResult.data.body_md,
        targetKeyword: assetResult.data.target_keyword,
        metaTitle: assetResult.data.meta_title,
        metaDescription: assetResult.data.meta_description,
        status: assetResult.data.status,
        publishedUrl: assetResult.data.published_url,
        aiConfidence: assetResult.data.ai_confidence === null ? null : Number(assetResult.data.ai_confidence),
        provenance: assetResult.data.provenance,
        createdAt: assetResult.data.created_at,
        updatedAt: assetResult.data.updated_at,
      });

      if (!["draft", "pending_review", "rejected", "failed"].includes(asset.status)) {
        throw new Error("Content asset is not eligible for generation.");
      }

      const [productResult, briefResult] = await Promise.all([
        supabase.from("products").select("id,name").eq("id", asset.productId).single(),
        supabase
          .from("marketing_briefs")
          .select(
            "id,product_id,version,tagline,value_props,personas,competitors,keyword_clusters,tone_profile,channels_ranked,content_calendar_seed,launch_date,provenance,created_at,updated_at",
          )
          .eq("product_id", asset.productId)
          .eq("version", asset.briefVersion)
          .single(),
      ]);

      if (productResult.error) {
        throw productResult.error;
      }

      if (briefResult.error) {
        throw briefResult.error;
      }

      const brief = marketingBriefSchema.parse({
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
      });

      return { asset, brief, product: productResult.data };
    });

    const draft = await step.run("compose-article-draft", async () =>
      buildArticleDraft({
        asset: inputs.asset,
        brief: inputs.brief,
        productName: inputs.product.name,
      }),
    );

    const updated = await step.run("persist-content-asset", async () => {
      const { data, error } = await supabase
        .from("content_assets")
        .update({
          title: draft.title,
          body_md: draft.bodyMd,
          meta_title: draft.metaTitle,
          meta_description: draft.metaDescription,
          status: "pending_review",
          ai_confidence: draft.aiConfidence,
          provenance: {
            ...inputs.asset.provenance,
            generator: "deterministic-content-v0",
            generatedAt: new Date().toISOString(),
            briefVersion: inputs.brief.version,
          },
        })
        .eq("id", inputs.asset.id)
        .select("id,product_id,title,target_keyword,ai_confidence")
        .single();

      if (error) {
        throw error;
      }

      return data;
    });

    await step.run("create-review-inbox-item", async () => {
      const existing = await supabase
        .from("inbox_items")
        .select("id")
        .eq("product_id", updated.product_id)
        .eq("source_entity_type", "content_asset")
        .eq("source_entity_id", updated.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existing.error) {
        throw existing.error;
      }

      if (existing.data) {
        return existing.data;
      }

      const { data, error } = await supabase
        .from("inbox_items")
        .insert({
          product_id: updated.product_id,
          item_type: "content_draft",
          source_entity_type: "content_asset",
          source_entity_id: updated.id,
          payload: {
            title: updated.title,
            preview: `${inputs.asset.type} draft for ${updated.target_keyword ?? "selected keyword"}.`,
            body: draft.bodyMd,
            targetKeyword: updated.target_keyword,
            metaTitle: draft.metaTitle,
            metaDescription: draft.metaDescription,
            suggestedAction: "Review the generated content draft before publishing or exporting.",
          },
          ai_confidence: draft.aiConfidence,
          impact_estimate: "high",
          review_time_estimate_seconds: 600,
        })
        .select("id,product_id")
        .single();

      if (error) {
        throw error;
      }

      const eventResult = await supabase.from("inbox_item_events").insert({
        inbox_item_id: data.id,
        product_id: data.product_id,
        event_type: "created",
        metadata: {
          sourceEntityType: "content_asset",
          sourceEntityId: updated.id,
          workflow: "content_generation",
        },
      });

      if (eventResult.error) {
        throw eventResult.error;
      }

      return data;
    });
  },
);

export const weeklyDigestGenerationWorkflow = inngest.createFunction(
  { id: "weekly-digest-generation-workflow", triggers: [{ event: "weekly_digest/generation.requested" }] },
  async ({ event, step }) => {
    const productId = event.data.productId as string;
    const supabase = createSupabaseAdminClient();
    const analyticsService = new AnalyticsService(supabase);

    const inputs = await step.run("load-weekly-digest-inputs", async () => {
      const productResult = await supabase.from("products").select("id,name,user_id").eq("id", productId).single();

      if (productResult.error) {
        throw productResult.error;
      }

      const userResult = await supabase.from("users").select("email").eq("id", productResult.data.user_id).single();

      if (userResult.error) {
        throw userResult.error;
      }

      const summary = await analyticsService.getDashboardSummaryForWorkflow(productId);

      return {
        product: productResult.data,
        userEmail: userResult.data.email,
        summary,
      };
    });

    const digest = await step.run("compose-weekly-digest", async () =>
      buildWeeklyDigest({
        productName: inputs.product.name,
        summary: inputs.summary,
      }),
    );

    const persisted = await step.run("persist-weekly-brief", async () =>
      analyticsService.upsertWeeklyBrief({
        productId,
        weekStart: digest.weekStart,
        summaryMd: digest.summaryMd,
        recommendations: digest.recommendations,
      }),
    );

    await step.run("create-weekly-recommendation-inbox-item", async () => {
      const existing = await supabase
        .from("inbox_items")
        .select("id")
        .eq("product_id", productId)
        .eq("source_entity_type", "weekly_brief")
        .eq("source_entity_id", persisted.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existing.error) {
        throw existing.error;
      }

      if (existing.data) {
        return existing.data;
      }

      const primaryRecommendation = persisted.recommendations[0];
      const itemResult = await supabase
        .from("inbox_items")
        .insert({
          product_id: productId,
          item_type: "weekly_recommendation",
          source_entity_type: "weekly_brief",
          source_entity_id: persisted.id,
          payload: {
            title: primaryRecommendation?.title ?? "Weekly digest ready",
            preview: primaryRecommendation?.rationale ?? "Review this week's performance summary.",
            body: persisted.summaryMd,
            suggestedAction: primaryRecommendation?.actionLabel ?? "Review weekly digest",
            metadata: { weekStart: persisted.weekStart, recommendations: persisted.recommendations },
          },
          ai_confidence: 0.82,
          impact_estimate: primaryRecommendation?.priority === "high" ? "high" : "medium",
          review_time_estimate_seconds: 300,
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
        metadata: { sourceEntityType: "weekly_brief", sourceEntityId: persisted.id, workflow: "weekly_digest_generation" },
      });

      if (eventResult.error) {
        throw eventResult.error;
      }

      return itemResult.data;
    });

    if (!isWeeklyDigestEmailConfigured()) {
      return persisted;
    }

    await step.run("send-weekly-digest-email", async () => {
      await sendWeeklyDigestEmail({
        to: inputs.userEmail,
        productName: inputs.product.name,
        brief: persisted,
      });

      const sentAt = new Date().toISOString();
      return analyticsService.upsertWeeklyBrief({
        productId,
        weekStart: persisted.weekStart,
        summaryMd: persisted.summaryMd,
        recommendations: persisted.recommendations,
        sentAt,
      });
    });
  },
);

export const functions = [briefGenerationWorkflow, productCrawlPlaceholder, contentGenerationWorkflow, weeklyDigestGenerationWorkflow];
