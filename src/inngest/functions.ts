import { inngest } from "@/inngest/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  generateBriefKeywordAnalysis,
  generateBriefPersonaAnalysis,
  synthesizeInitialBrief,
} from "@/server/brief/build-initial-brief";
import {
  assembleArticleDraft,
  generateArticleOutline,
  generateFullArticleDraft,
  researchSearcherIntent,
  reviewArticleSeo,
} from "@/server/content/build-article-draft";
import {
  buildContentGenerationSteps,
  completeContentGenerationSteps,
  getContentGenerationState,
} from "@/server/content/generation-state";
import { extractPageSignals } from "@/server/crawl/extract-page-signals";
import { isWeeklyDigestEmailConfigured, sendWeeklyDigestEmail } from "@/server/email/weekly-digest-email";
import { contentAssetSchema } from "@/server/schemas/content";
import { marketingBriefSchema } from "@/server/schemas/brief";
import type { MarketingBrief } from "@/server/schemas/brief";
import { AnalyticsService, buildWeeklyDigest } from "@/server/services/analytics-service";
import { captureWorkflowException, logWorkflowEvent } from "@/server/observability/workflow-logger";

export const briefGenerationWorkflow = inngest.createFunction(
  { id: "brief-generation-workflow", triggers: [{ event: "brief/generation.requested" }] },
  async ({ event, step }) => {
    const workflow = "brief_generation";
    const productId = event.data.productId as string;
    const briefGenerationJobId = event.data.briefGenerationJobId as string | undefined;
    const supabase = createSupabaseAdminClient();
    logWorkflowEvent({ workflow, status: "started", eventName: event.name, productId, entityId: briefGenerationJobId });

    try {
      if (!briefGenerationJobId) {
        logWorkflowEvent({
          workflow,
          status: "failed",
          eventName: event.name,
          productId,
          metadata: { reason: "missing_brief_generation_job_id" },
        });
        return null;
      }

      await step.run("mark-brief-generation-running", async () => {
        const { error } = await supabase
          .from("brief_generation_jobs")
          .update({
            status: "running",
            progress_percent: 10,
            steps: [
              { label: "Load product context", status: "running" },
              { label: "Analyze audience", status: "pending" },
              { label: "Cluster keywords", status: "pending" },
              { label: "Write Marketing Brief", status: "pending" },
            ],
          })
          .eq("id", briefGenerationJobId);

        if (error) {
          throw error;
        }
      });

      const inputs = await step.run("load-brief-inputs", async () => {
      const [productResult, crawlResult, answersResult] = await Promise.all([
        supabase.from("products").select("id,name,url,user_id,current_marketing_brief_id").eq("id", productId).single(),
        supabase
          .from("crawl_results")
          .select("id,page_title,meta_description,h1,extracted_signals,created_at")
          .eq("product_id", productId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("interview_answers").select("question_id,answer").eq("product_id", productId),
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

      let currentBriefAlreadyFresh = null;
      if (productResult.data.current_marketing_brief_id && crawlResult.data?.id) {
        const currentBriefResult = await supabase
          .from("marketing_briefs")
          .select(
            "id,product_id,version,tagline,value_props,personas,competitors,keyword_clusters,tone_profile,channels_ranked,content_calendar_seed,launch_date,provenance,created_at,updated_at",
          )
          .eq("id", productResult.data.current_marketing_brief_id)
          .maybeSingle();

        if (currentBriefResult.error) {
          throw currentBriefResult.error;
        }

        const provenance = currentBriefResult.data?.provenance;
        const generator =
          provenance && typeof provenance === "object" && !Array.isArray(provenance)
            ? (provenance as Record<string, unknown>).generator
            : null;
        const crawlResultId =
          provenance && typeof provenance === "object" && !Array.isArray(provenance)
            ? (provenance as Record<string, unknown>).crawlResultId
            : null;

        if (currentBriefResult.data && generator === "ai-router-v1" && crawlResultId === crawlResult.data.id) {
          currentBriefAlreadyFresh = mapWorkflowMarketingBrief(currentBriefResult.data);
        }
      }

      return {
        product: productResult.data,
        crawl: crawlResult.data,
        answers: answersResult.data,
        nextVersion: 1,
        userId: productResult.data.user_id,
        currentBriefAlreadyFresh,
      };
    });

      const currentBriefAlreadyFresh = inputs.currentBriefAlreadyFresh;

      if (currentBriefAlreadyFresh) {
        await step.run("mark-brief-generation-skipped-complete", async () => {
          const { error } = await supabase
            .from("brief_generation_jobs")
            .update({
              status: "completed",
              progress_percent: 100,
              marketing_brief_id: currentBriefAlreadyFresh.id,
              completed_at: new Date().toISOString(),
              steps: [
                { label: "Load product context", status: "completed" },
                { label: "Analyze audience", status: "completed" },
                { label: "Cluster keywords", status: "completed" },
                { label: "Write Marketing Brief", status: "completed" },
              ],
            })
            .eq("id", briefGenerationJobId);

          if (error) {
            throw error;
          }
        });

        logWorkflowEvent({
          workflow,
          status: "succeeded",
          eventName: event.name,
          productId,
          entityId: briefGenerationJobId,
          metadata: {
            skipped: "current_brief_already_uses_latest_crawl",
            briefVersion: currentBriefAlreadyFresh.version,
          },
        });
        return currentBriefAlreadyFresh;
      }

      await step.run("mark-audience-analysis-running", async () => {
        const { error } = await supabase
          .from("brief_generation_jobs")
          .update({
            progress_percent: 25,
            steps: [
              { label: "Load product context", status: "completed" },
              { label: "Analyze audience", status: "running" },
              { label: "Cluster keywords", status: "pending" },
              { label: "Write Marketing Brief", status: "pending" },
            ],
          })
          .eq("id", briefGenerationJobId);

        if (error) {
          throw error;
        }
      });

      const personaAnalysis = await step.run("generate-personas-jtbd", async () =>
        generateBriefPersonaAnalysis({ ...inputs, supabase }),
      );

      await step.run("mark-keyword-analysis-running", async () => {
        const { error } = await supabase
          .from("brief_generation_jobs")
          .update({
            progress_percent: 55,
            steps: [
              { label: "Load product context", status: "completed" },
              { label: "Analyze audience", status: "completed" },
              { label: "Cluster keywords", status: "running" },
              { label: "Write Marketing Brief", status: "pending" },
            ],
          })
          .eq("id", briefGenerationJobId);

        if (error) {
          throw error;
        }
      });

      const keywordAnalysis = await step.run("generate-keyword-clusters", async () =>
        generateBriefKeywordAnalysis({ inputs: { ...inputs, supabase }, personaAnalysis }),
      );

      await step.run("mark-brief-synthesis-running", async () => {
        const { error } = await supabase
          .from("brief_generation_jobs")
          .update({
            progress_percent: 80,
            steps: [
              { label: "Load product context", status: "completed" },
              { label: "Analyze audience", status: "completed" },
              { label: "Cluster keywords", status: "completed" },
              { label: "Write Marketing Brief", status: "running" },
            ],
          })
          .eq("id", briefGenerationJobId);

        if (error) {
          throw error;
        }
      });

      const brief = await step.run("synthesize-brief", async () =>
        synthesizeInitialBrief({ inputs: { ...inputs, supabase }, personaAnalysis, keywordAnalysis }),
      );

      const inserted = await step.run("persist-brief-version", async () => {
        return insertMarketingBriefWithNextVersion({
          supabase,
          productId,
          brief,
          currentBrief: currentBriefAlreadyFresh,
        });
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

      await step.run("mark-brief-generation-complete", async () => {
        const { error } = await supabase
          .from("brief_generation_jobs")
          .update({
            status: "completed",
            progress_percent: 100,
            marketing_brief_id: inserted.id,
            completed_at: new Date().toISOString(),
            steps: [
              { label: "Load product context", status: "completed" },
              { label: "Analyze audience", status: "completed" },
              { label: "Cluster keywords", status: "completed" },
              { label: "Write Marketing Brief", status: "completed" },
            ],
          })
          .eq("id", briefGenerationJobId);

        if (error) {
          throw error;
        }
      });

      logWorkflowEvent({ workflow, status: "succeeded", eventName: event.name, productId, entityId: briefGenerationJobId, metadata: { briefVersion: inserted.version } });
    } catch (error) {
      if (briefGenerationJobId) {
        await supabase
          .from("brief_generation_jobs")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message.slice(0, 500) : "Unknown brief generation failure.",
            steps: [
              { label: "Load product context", status: "completed" },
              { label: "Analyze audience", status: "failed" },
              { label: "Cluster keywords", status: "pending" },
              { label: "Write Marketing Brief", status: "pending" },
            ],
          })
          .eq("id", briefGenerationJobId);
      }

      captureWorkflowException(error, { workflow, eventName: event.name, productId });
      throw error;
    }
  },
);

export const productCrawlPlaceholder = inngest.createFunction(
  { id: "product-crawl-placeholder", triggers: [{ event: "product/crawl.requested" }] },
  async ({ event, step }) => {
    const workflow = "product_crawl";
    const crawlJobId = event.data.crawlJobId as string;
    const productId = event.data.productId as string;
    const supabase = createSupabaseAdminClient();
    logWorkflowEvent({ workflow, status: "started", eventName: event.name, productId, entityId: crawlJobId });

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
        let response;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
          
          response = await fetch(product.url, {
            headers: {
              "user-agent": "Mozilla/5.0 (compatible; LaunchBeaconBot/0.1)",
              accept: "text/html,application/xhtml+xml",
            },
            redirect: "follow",
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText} from ${product.url}`);
          }
        } catch (fetchError) {
          const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
          throw new Error(`Failed to fetch ${product.url}: ${errorMsg}`);
        }

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
                crawler: "LaunchBeaconBot/0.1",
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

      logWorkflowEvent({ workflow, status: "succeeded", eventName: event.name, productId, entityId: crawlJobId });
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

      captureWorkflowException(error, { workflow, eventName: event.name, productId, entityId: crawlJobId });
      throw error;
    }
  },
);

export const contentGenerationWorkflow = inngest.createFunction(
  { id: "content-generation-workflow", triggers: [{ event: "content/generation.requested" }] },
  async ({ event, step }) => {
    const workflow = "content_generation";
    const contentAssetId = event.data.contentAssetId as string;
    const supabase = createSupabaseAdminClient();
    logWorkflowEvent({ workflow, status: "started", eventName: event.name, entityId: contentAssetId });

    try {
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
        supabase.from("products").select("id,name,user_id").eq("id", asset.productId).single(),
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

      const articleInput = {
        supabase,
        asset: inputs.asset,
        brief: inputs.brief,
        productName: inputs.product.name,
        userId: inputs.product.user_id,
      };

      await step.run("mark-intent-research-running", async () =>
        updateContentGenerationProgress({
          supabase,
          contentAssetId,
          status: "running",
          progressPercent: 12,
          activeLabel: "Research search intent",
        }),
      );

      const searchIntent = await step.run("research-searcher-intent", async () =>
        researchSearcherIntent(articleInput),
      );

      await step.run("mark-outline-running", async () =>
        updateContentGenerationProgress({
          supabase,
          contentAssetId,
          status: "running",
          progressPercent: 30,
          activeLabel: "Generate article outline",
        }),
      );

      const outline = await step.run("generate-article-outline", async () =>
        generateArticleOutline({ ...articleInput, searchIntent }),
      );

      await step.run("mark-draft-running", async () =>
        updateContentGenerationProgress({
          supabase,
          contentAssetId,
          status: "running",
          progressPercent: 55,
          activeLabel: "Draft full article",
        }),
      );

      const articleBody = await step.run("draft-full-article", async () =>
        generateFullArticleDraft({ ...articleInput, searchIntent, outline }),
      );

      await step.run("mark-seo-review-running", async () =>
        updateContentGenerationProgress({
          supabase,
          contentAssetId,
          status: "running",
          progressPercent: 82,
          activeLabel: "Review SEO metadata",
        }),
      );

      const seoReview = await step.run("review-article-seo", async () =>
        reviewArticleSeo({ ...articleInput, searchIntent, outline, draft: articleBody }),
      );

      const draft = assembleArticleDraft({
        input: articleInput,
        searchIntent,
        outline,
        draft: articleBody,
        seoReview,
      });

      await step.run("mark-review-item-running", async () =>
        updateContentGenerationProgress({
          supabase,
          contentAssetId,
          status: "running",
          progressPercent: 95,
          activeLabel: "Create review item",
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
            ...draft.provenance,
            generation: {
              status: "completed",
              progressPercent: 100,
              steps: completeContentGenerationSteps(),
              requestedAt: getGenerationRequestedAt(inputs.asset.provenance),
              updatedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
            },
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

      logWorkflowEvent({ workflow, status: "succeeded", eventName: event.name, productId: updated.product_id, entityId: contentAssetId });
    } catch (error) {
      await markContentGenerationFailed({
        supabase,
        contentAssetId,
        errorMessage: error instanceof Error ? error.message : "Unknown content generation failure.",
      });
      captureWorkflowException(error, { workflow, eventName: event.name, entityId: contentAssetId });
      throw error;
    }
  },
);

export const weeklyDigestGenerationWorkflow = inngest.createFunction(
  { id: "weekly-digest-generation-workflow", triggers: [{ event: "weekly_digest/generation.requested" }] },
  async ({ event, step }) => {
    const workflow = "weekly_digest_generation";
    const productId = event.data.productId as string;
    const supabase = createSupabaseAdminClient();
    const analyticsService = new AnalyticsService(supabase);
    logWorkflowEvent({ workflow, status: "started", eventName: event.name, productId });

    try {
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
        logWorkflowEvent({ workflow, status: "succeeded", eventName: event.name, productId, entityId: persisted.id, metadata: { emailConfigured: false } });
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

      logWorkflowEvent({ workflow, status: "succeeded", eventName: event.name, productId, entityId: persisted.id, metadata: { emailConfigured: true } });
      return persisted;
    } catch (error) {
      captureWorkflowException(error, { workflow, eventName: event.name, productId });
      throw error;
    }
  },
);

export const functions = [briefGenerationWorkflow, productCrawlPlaceholder, contentGenerationWorkflow, weeklyDigestGenerationWorkflow];

type GeneratedBrief = Awaited<ReturnType<typeof synthesizeInitialBrief>>;

async function insertMarketingBriefWithNextVersion(input: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  productId: string;
  brief: GeneratedBrief;
  currentBrief: MarketingBrief | null;
}) {
  if (input.currentBrief && areWorkflowBriefsEquivalent(input.currentBrief, input.brief)) {
    return {
      id: input.currentBrief.id,
      version: input.currentBrief.version,
      unchanged: true,
    };
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: versionRows, error: versionError } = await input.supabase
      .from("marketing_briefs")
      .select("version")
      .eq("product_id", input.productId)
      .order("version", { ascending: false })
      .limit(1);

    if (versionError) {
      throw versionError;
    }

    const nextVersion = (versionRows[0]?.version ?? 0) + 1;
    const { data, error } = await input.supabase
      .from("marketing_briefs")
      .insert({
        product_id: input.productId,
        version: nextVersion,
        tagline: input.brief.tagline,
        value_props: input.brief.valueProps,
        personas: input.brief.personas,
        competitors: input.brief.competitors,
        keyword_clusters: input.brief.keywordClusters,
        tone_profile: input.brief.toneProfile,
        channels_ranked: input.brief.channelsRanked,
        content_calendar_seed: input.brief.contentCalendarSeed,
        provenance: {
          ...input.brief.provenance,
          versionAllocatedAt: new Date().toISOString(),
        },
      })
      .select("id,version")
      .single();

    if (!error) {
      return { ...data, unchanged: false };
    }

    lastError = error;
    if (error.code !== "23505") {
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Marketing Brief version could not be allocated after retry.");
}

function mapWorkflowMarketingBrief(data: {
  id: string;
  product_id: string;
  version: number;
  tagline: string;
  value_props: unknown;
  personas: unknown;
  competitors: unknown;
  keyword_clusters: unknown;
  tone_profile: unknown;
  channels_ranked: unknown;
  content_calendar_seed: unknown;
  launch_date: string | null;
  provenance: unknown;
  created_at: string;
  updated_at: string;
}) {
  return marketingBriefSchema.parse({
    id: data.id,
    productId: data.product_id,
    version: data.version,
    tagline: data.tagline,
    valueProps: data.value_props,
    personas: data.personas,
    competitors: data.competitors,
    keywordClusters: data.keyword_clusters,
    toneProfile: data.tone_profile,
    channelsRanked: data.channels_ranked,
    contentCalendarSeed: data.content_calendar_seed,
    launchDate: data.launch_date,
    provenance: data.provenance,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}

type ComparableWorkflowBrief = Pick<
  MarketingBrief,
  | "tagline"
  | "valueProps"
  | "personas"
  | "competitors"
  | "keywordClusters"
  | "toneProfile"
  | "channelsRanked"
  | "contentCalendarSeed"
>;

function areWorkflowBriefsEquivalent(a: ComparableWorkflowBrief, b: ComparableWorkflowBrief) {
  return canonicalizeWorkflowBrief(a) === canonicalizeWorkflowBrief(b);
}

function canonicalizeWorkflowBrief(brief: ComparableWorkflowBrief) {
  return JSON.stringify({
    tagline: normalizeWorkflowString(brief.tagline),
    valueProps: normalizeWorkflowStringArray(brief.valueProps),
    personas: normalizeWorkflowStringArray(brief.personas),
    competitors: normalizeWorkflowStringArray(brief.competitors),
    keywordClusters: brief.keywordClusters.map((cluster) => ({
      name: normalizeWorkflowString(cluster.name),
      keywords: normalizeWorkflowStringArray(cluster.keywords),
    })),
    toneProfile: {
      voice: normalizeWorkflowString(brief.toneProfile.voice),
      avoid: normalizeWorkflowStringArray(brief.toneProfile.avoid),
    },
    channelsRanked: brief.channelsRanked.map((channel) => ({
      channel: normalizeWorkflowString(channel.channel),
      rationale: normalizeWorkflowString(channel.rationale),
    })),
    contentCalendarSeed: brief.contentCalendarSeed.map((seed) => ({
      title: normalizeWorkflowString(seed.title),
      format: normalizeWorkflowString(seed.format),
      rationale: normalizeWorkflowString(seed.rationale),
    })),
  });
}

function normalizeWorkflowString(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeWorkflowStringArray(values: string[]) {
  return values.map(normalizeWorkflowString).filter(Boolean);
}

async function updateContentGenerationProgress(input: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  contentAssetId: string;
  status: "queued" | "running";
  progressPercent: number;
  activeLabel: string;
}) {
  const current = await input.supabase
    .from("content_assets")
    .select("provenance")
    .eq("id", input.contentAssetId)
    .single();

  if (current.error) {
    throw current.error;
  }

  const provenance =
    current.data.provenance && typeof current.data.provenance === "object" && !Array.isArray(current.data.provenance)
      ? (current.data.provenance as Record<string, unknown>)
      : {};
  const generation = getContentGenerationState(provenance);
  const { error } = await input.supabase
    .from("content_assets")
    .update({
      provenance: {
        ...provenance,
        generation: {
          status: input.status,
          progressPercent: input.progressPercent,
          steps: buildContentGenerationSteps(input.activeLabel),
          requestedAt: generation?.requestedAt,
          updatedAt: new Date().toISOString(),
        },
      },
    })
    .eq("id", input.contentAssetId);

  if (error) {
    throw error;
  }
}

async function markContentGenerationFailed(input: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  contentAssetId: string;
  errorMessage: string;
}) {
  const current = await input.supabase
    .from("content_assets")
    .select("provenance")
    .eq("id", input.contentAssetId)
    .maybeSingle();

  const provenance =
    current.data?.provenance && typeof current.data.provenance === "object" && !Array.isArray(current.data.provenance)
      ? (current.data.provenance as Record<string, unknown>)
      : {};
  const generation = getContentGenerationState(provenance);
  const activeStep = generation?.steps.find((step) => step.status === "running")?.label ?? "Research search intent";

  await input.supabase
    .from("content_assets")
    .update({
      status: "failed",
      provenance: {
        ...provenance,
        generation: {
          status: "failed",
          progressPercent: generation?.progressPercent ?? 0,
          steps: buildContentGenerationSteps(activeStep).map((step) =>
            step.label === activeStep ? { ...step, status: "failed" as const } : step,
          ),
          requestedAt: generation?.requestedAt,
          updatedAt: new Date().toISOString(),
          errorMessage: input.errorMessage.slice(0, 500),
        },
      },
    })
    .eq("id", input.contentAssetId);
}

function getGenerationRequestedAt(provenance: Record<string, unknown>) {
  return getContentGenerationState(provenance)?.requestedAt;
}
