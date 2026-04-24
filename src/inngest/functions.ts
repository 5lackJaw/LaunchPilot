import { inngest } from "@/inngest/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractPageSignals } from "@/server/crawl/extract-page-signals";

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

export const functions = [briefGenerationWorkflow, productCrawlPlaceholder];

function buildInitialBrief(inputs: {
  product: { id: string; name: string; url: string };
  crawl: { id: string; page_title: string | null; meta_description: string | null; h1: string | null; extracted_signals: unknown; created_at: string } | null;
  answers: Array<{ question_id: string; answer: string }>;
  nextVersion: number;
}) {
  const answers = Object.fromEntries(inputs.answers.map((answer) => [answer.question_id, answer.answer.trim()]));
  const bestCustomer = answers.best_customer || "Best-fit customers need confirmation in the interview.";
  const pain = answers.pain || "Primary customer pain still needs confirmation.";
  const difference = answers.difference || "Differentiation still needs confirmation.";
  const proof = answers.proof || "Proof points still need confirmation.";
  const tone = answers.tone || "Direct and practical";
  const pageTitle = inputs.crawl?.page_title ?? inputs.crawl?.h1 ?? inputs.product.name;
  const metaDescription = inputs.crawl?.meta_description ?? "";
  const seedKeyword = normalizeKeyword(inputs.crawl?.h1 ?? pageTitle ?? inputs.product.name);

  return {
    version: inputs.nextVersion,
    tagline: firstSentence(metaDescription) || `${inputs.product.name} helps ${bestCustomer.toLowerCase()} solve a specific launch problem.`,
    valueProps: [
      pain,
      difference,
      proof,
    ].filter(Boolean),
    personas: [bestCustomer],
    competitors: [],
    keywordClusters: [
      {
        name: "Core product intent",
        keywords: [seedKeyword, `${seedKeyword} alternative`, `${seedKeyword} guide`],
      },
      {
        name: "Problem-aware searches",
        keywords: [normalizeKeyword(pain), `how to ${normalizeKeyword(pain)}`],
      },
    ],
    toneProfile: {
      voice: tone,
      avoid: ["marketing jargon", "unsupported claims", "overpromising automation"],
    },
    channelsRanked: [
      {
        channel: "SEO content",
        rationale: "Crawl and interview inputs provide enough product context for durable evergreen content.",
      },
      {
        channel: "Community",
        rationale: "Founder-authored answers can guide helpful, review-gated replies.",
      },
      {
        channel: "Directories",
        rationale: "The product URL and positioning inputs can seed listing packages.",
      },
    ],
    contentCalendarSeed: [
      {
        title: `${titleCase(seedKeyword)} guide`,
        format: "article",
        rationale: "Start with bottom-of-funnel product intent from the crawled page.",
      },
      {
        title: `How ${bestCustomer.toLowerCase()} can solve ${pain.toLowerCase()}`,
        format: "problem guide",
        rationale: "Translate the interview pain point into a practical search-focused topic.",
      },
      {
        title: `${inputs.product.name} vs manual alternatives`,
        format: "comparison",
        rationale: "Explain the product difference in a buyer-friendly format.",
      },
    ],
    provenance: {
      generator: "deterministic-v0",
      productId: inputs.product.id,
      crawlResultId: inputs.crawl?.id ?? null,
      interviewAnswerCount: inputs.answers.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

function firstSentence(value: string) {
  return value.split(/[.!?]/)[0]?.trim() ?? "";
}

function normalizeKeyword(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
