import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { inngest } from "@/inngest/client";
import { buildInitialBrief } from "@/server/brief/build-initial-brief";
import { briefGenerationJobSchema } from "@/server/schemas/brief-generation-job";
import type { BriefGenerationJob } from "@/server/schemas/brief-generation-job";
import { editMarketingBriefSchema, marketingBriefSchema } from "@/server/schemas/brief";
import type { MarketingBrief } from "@/server/schemas/brief";
import { productIdSchema } from "@/server/schemas/product";
import { AuthService } from "@/server/services/auth-service";
import { shouldUseAdminOverride } from "@/server/services/admin-service";
import { ProductService } from "@/server/services/product-service";

const initialBriefGenerationSteps = [
  { label: "Load product context", status: "pending" },
  { label: "Analyze audience", status: "pending" },
  { label: "Cluster keywords", status: "pending" },
  { label: "Write Marketing Brief", status: "pending" },
] as const;

const setCurrentBriefVersionSchema = productIdSchema.extend({
  briefId: z.string().uuid(),
});

export class BriefService {
  constructor(private readonly supabase: SupabaseClient) {}

  async requestGeneration(input: unknown) {
    const { productId } = productIdSchema.parse(input);
    const requestedAdminOverride =
      typeof input === "object" &&
      input !== null &&
      "adminOverride" in input &&
      Boolean((input as { adminOverride?: unknown }).adminOverride);
    const user = await new AuthService(this.supabase).requireUser();
    const adminOverride = shouldUseAdminOverride({ user, requested: requestedAdminOverride });

    await new ProductService(this.supabase).getProduct({ productId });
    await this.assertGenerationCanStart({ productId, adminOverride });

    const crawlResult = await this.supabase
      .from("crawl_results")
      .select("id")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (crawlResult.error) {
      throw new BriefGenerationRequestError(crawlResult.error.message);
    }

    const { data, error } = await this.supabase
      .from("brief_generation_jobs")
      .insert({
        product_id: productId,
        status: "queued",
        progress_percent: 0,
        steps: initialBriefGenerationSteps,
        crawl_result_id: crawlResult.data?.id ?? null,
        admin_override: adminOverride,
      })
      .select(
        "id,product_id,status,progress_percent,steps,crawl_result_id,marketing_brief_id,error_message,admin_override,created_at,updated_at,completed_at",
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new BriefGenerationBlockedError("Marketing Brief generation is already running for this product.");
      }

      throw new BriefGenerationRequestError(error.message);
    }

    const job = mapBriefGenerationJob(data);

    try {
      await inngest.send({
        name: "brief/generation.requested",
        data: {
          productId,
          briefGenerationJobId: job.id,
        },
      });
    } catch (error) {
      await this.supabase
        .from("brief_generation_jobs")
        .update({
          status: "failed",
          progress_percent: 0,
          error_message: "Workflow event dispatch failed.",
        })
        .eq("id", job.id);

      throw error;
    }

    return job;
  }

  async generateInitialBriefNow(input: unknown): Promise<MarketingBrief> {
    const { productId } = productIdSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId });

    const user = await new AuthService(this.supabase).requireUser();
    const [productResult, crawlResult, answersResult, versionResult] = await Promise.all([
      this.supabase.from("products").select("id,name,url").eq("id", productId).single(),
      this.supabase
        .from("crawl_results")
        .select("id,page_title,meta_description,h1,extracted_signals,created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.supabase.from("interview_answers").select("question_id,answer").eq("product_id", productId),
      this.supabase.from("marketing_briefs").select("version").eq("product_id", productId).order("version", { ascending: false }).limit(1),
    ]);

    if (productResult.error) {
      throw new BriefGenerationRequestError(productResult.error.message);
    }

    if (crawlResult.error) {
      throw new BriefGenerationRequestError(crawlResult.error.message);
    }

    if (answersResult.error) {
      throw new BriefGenerationRequestError(answersResult.error.message);
    }

    if (versionResult.error) {
      throw new BriefGenerationRequestError(versionResult.error.message);
    }

    const currentBrief = await this.getCurrentBrief({ productId });
    if (
      currentBrief &&
      crawlResult.data?.id &&
      getProvenanceString(currentBrief.provenance, "generator") === "ai-router-v1" &&
      getProvenanceString(currentBrief.provenance, "crawlResultId") === crawlResult.data.id
    ) {
      return currentBrief;
    }

    const brief = await buildInitialBrief({
      supabase: this.supabase,
      product: productResult.data,
      crawl: crawlResult.data,
      answers: answersResult.data,
      nextVersion: (versionResult.data[0]?.version ?? 0) + 1,
      userId: user.id,
    });

    if (currentBrief && areBriefsEquivalent(currentBrief, brief)) {
      return currentBrief;
    }

    const { data, error } = await this.supabase
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
        provenance: {
          ...brief.provenance,
          execution: "server_action",
        },
      })
      .select(
        "id,product_id,version,tagline,value_props,personas,competitors,keyword_clusters,tone_profile,channels_ranked,content_calendar_seed,launch_date,provenance,created_at,updated_at",
      )
      .single();

    if (error) {
      throw new BriefGenerationRequestError(error.message);
    }

    const inserted = mapMarketingBrief(data);

    const { error: productError } = await this.supabase
      .from("products")
      .update({
        current_marketing_brief_id: inserted.id,
        status: "onboarding",
      })
      .eq("id", productId);

    if (productError) {
      throw new BriefGenerationRequestError(productError.message);
    }

    return inserted;
  }

  async getCurrentBrief(input: unknown): Promise<MarketingBrief | null> {
    const { productId } = productIdSchema.parse(input);
    await new AuthService(this.supabase).requireUser();

    const { data: product, error: productError } = await this.supabase
      .from("products")
      .select("current_marketing_brief_id")
      .eq("id", productId)
      .single();

    if (productError) {
      throw new BriefReadError(productError.message);
    }

    let query = this.supabase
      .from("marketing_briefs")
      .select(
        "id,product_id,version,tagline,value_props,personas,competitors,keyword_clusters,tone_profile,channels_ranked,content_calendar_seed,launch_date,provenance,created_at,updated_at",
      )
      .eq("product_id", productId);

    if (product.current_marketing_brief_id) {
      query = query.eq("id", product.current_marketing_brief_id);
    } else {
      query = query.order("version", { ascending: false }).limit(1);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new BriefReadError(error.message);
    }

    return data ? mapMarketingBrief(data) : null;
  }

  async getLatestGenerationJob(input: unknown): Promise<BriefGenerationJob | null> {
    const { productId } = productIdSchema.parse(input);
    await new AuthService(this.supabase).requireUser();

    const { data, error } = await this.supabase
      .from("brief_generation_jobs")
      .select(
        "id,product_id,status,progress_percent,steps,crawl_result_id,marketing_brief_id,error_message,admin_override,created_at,updated_at,completed_at",
      )
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new BriefReadError(error.message);
    }

    return data ? mapBriefGenerationJob(data) : null;
  }

  async listBriefVersions(input: unknown): Promise<MarketingBrief[]> {
    const { productId } = productIdSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId });

    const { data, error } = await this.supabase
      .from("marketing_briefs")
      .select(
        "id,product_id,version,tagline,value_props,personas,competitors,keyword_clusters,tone_profile,channels_ranked,content_calendar_seed,launch_date,provenance,created_at,updated_at",
      )
      .eq("product_id", productId)
      .order("version", { ascending: false });

    if (error) {
      throw new BriefReadError(error.message);
    }

    return (data ?? []).map(mapMarketingBrief);
  }

  async setCurrentBriefVersion(input: unknown): Promise<MarketingBrief> {
    const parsed = setCurrentBriefVersionSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId: parsed.productId });

    const { data, error } = await this.supabase
      .from("marketing_briefs")
      .select(
        "id,product_id,version,tagline,value_props,personas,competitors,keyword_clusters,tone_profile,channels_ranked,content_calendar_seed,launch_date,provenance,created_at,updated_at",
      )
      .eq("product_id", parsed.productId)
      .eq("id", parsed.briefId)
      .single();

    if (error) {
      throw new BriefReadError(error.message);
    }

    const brief = mapMarketingBrief(data);
    const { error: productError } = await this.supabase
      .from("products")
      .update({ current_marketing_brief_id: brief.id })
      .eq("id", parsed.productId);

    if (productError) {
      throw new BriefEditError(productError.message);
    }

    return brief;
  }

  async createEditedVersion(input: unknown): Promise<MarketingBrief> {
    const parsed = editMarketingBriefSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId: parsed.productId });
    const currentBrief = await this.getCurrentBrief({ productId: parsed.productId });

    if (!currentBrief) {
      throw new BriefEditError("No current Marketing Brief exists for this product.");
    }

    const editedComparable = {
      tagline: parsed.tagline,
      valueProps: parsed.valueProps,
      personas: parsed.personas,
      competitors: parsed.competitors,
      keywordClusters: currentBrief.keywordClusters,
      toneProfile: {
        voice: parsed.toneVoice,
        avoid: parsed.toneAvoid,
      },
      channelsRanked: currentBrief.channelsRanked,
      contentCalendarSeed: currentBrief.contentCalendarSeed,
    };

    if (areBriefsEquivalent(currentBrief, editedComparable)) {
      return currentBrief;
    }

    const nextVersion = currentBrief.version + 1;
    const provenance = {
      ...currentBrief.provenance,
      editor: "user",
      previousBriefId: currentBrief.id,
      editedAt: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from("marketing_briefs")
      .insert({
        product_id: parsed.productId,
        version: nextVersion,
        tagline: parsed.tagline,
        value_props: parsed.valueProps,
        personas: parsed.personas,
        competitors: parsed.competitors,
        keyword_clusters: currentBrief.keywordClusters,
        tone_profile: {
          voice: parsed.toneVoice,
          avoid: parsed.toneAvoid,
        },
        channels_ranked: currentBrief.channelsRanked,
        content_calendar_seed: currentBrief.contentCalendarSeed,
        launch_date: currentBrief.launchDate,
        provenance,
      })
      .select(
        "id,product_id,version,tagline,value_props,personas,competitors,keyword_clusters,tone_profile,channels_ranked,content_calendar_seed,launch_date,provenance,created_at,updated_at",
      )
      .single();

    if (error) {
      throw new BriefEditError(error.message);
    }

    const brief = mapMarketingBrief(data);

    const { error: productError } = await this.supabase
      .from("products")
      .update({
        current_marketing_brief_id: brief.id,
      })
      .eq("id", parsed.productId);

    if (productError) {
      throw new BriefEditError(productError.message);
    }

    return brief;
  }

  private async assertGenerationCanStart(input: {
    productId: string;
    adminOverride: boolean;
  }) {
    const latest = await this.getLatestGenerationJob({ productId: input.productId });

    if (latest?.status === "queued" || latest?.status === "running") {
      throw new BriefGenerationBlockedError("Marketing Brief generation is already running for this product.");
    }

    if (input.adminOverride) {
      return;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.supabase
      .from("brief_generation_jobs")
      .select("id,created_at")
      .eq("product_id", input.productId)
      .neq("status", "failed")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new BriefGenerationRequestError(error.message);
    }

    if (data) {
      throw new BriefGenerationBlockedError(
        `Marketing Brief generation is limited to once every 24 hours. Next generation is available ${formatNextAvailable(data.created_at)}.`,
      );
    }
  }
}

function getProvenanceString(provenance: unknown, key: string) {
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    return null;
  }

  const value = (provenance as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

type ComparableBrief = Pick<
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

function areBriefsEquivalent(a: ComparableBrief, b: ComparableBrief) {
  return canonicalizeBrief(a) === canonicalizeBrief(b);
}

function canonicalizeBrief(brief: ComparableBrief) {
  return JSON.stringify({
    tagline: normalizeString(brief.tagline),
    valueProps: normalizeStringArray(brief.valueProps),
    personas: normalizeStringArray(brief.personas),
    competitors: normalizeStringArray(brief.competitors),
    keywordClusters: brief.keywordClusters.map((cluster) => ({
      name: normalizeString(cluster.name),
      keywords: normalizeStringArray(cluster.keywords),
    })),
    toneProfile: {
      voice: normalizeString(brief.toneProfile.voice),
      avoid: normalizeStringArray(brief.toneProfile.avoid),
    },
    channelsRanked: brief.channelsRanked.map((channel) => ({
      channel: normalizeString(channel.channel),
      rationale: normalizeString(channel.rationale),
    })),
    contentCalendarSeed: brief.contentCalendarSeed.map((seed) => ({
      title: normalizeString(seed.title),
      format: normalizeString(seed.format),
      rationale: normalizeString(seed.rationale),
    })),
  });
}

function normalizeString(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeStringArray(values: string[]) {
  return values.map(normalizeString).filter(Boolean);
}

export class BriefGenerationRequestError extends Error {
  constructor(message: string) {
    super(`Brief generation could not be requested: ${message}`);
    this.name = "BriefGenerationRequestError";
  }
}

export class BriefGenerationBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BriefGenerationBlockedError";
  }
}

export class BriefReadError extends Error {
  constructor(message: string) {
    super(`Marketing brief could not be loaded: ${message}`);
    this.name = "BriefReadError";
  }
}

export class BriefEditError extends Error {
  constructor(message: string) {
    super(`Marketing brief could not be edited: ${message}`);
    this.name = "BriefEditError";
  }
}

export function mapMarketingBrief(data: {
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

export function mapBriefGenerationJob(data: {
  id: string;
  product_id: string;
  status: string;
  progress_percent: number;
  steps: unknown;
  crawl_result_id: string | null;
  marketing_brief_id: string | null;
  error_message: string | null;
  admin_override: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}) {
  return briefGenerationJobSchema.parse({
    id: data.id,
    productId: data.product_id,
    status: data.status,
    progressPercent: data.progress_percent,
    steps: data.steps,
    crawlResultId: data.crawl_result_id,
    marketingBriefId: data.marketing_brief_id,
    errorMessage: data.error_message,
    adminOverride: data.admin_override,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    completedAt: data.completed_at,
  });
}

function formatNextAvailable(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(new Date(value).getTime() + 24 * 60 * 60 * 1000));
}
