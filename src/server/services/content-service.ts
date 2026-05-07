import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import {
  buildContentGenerationSteps,
  getContentGenerationState,
  type ContentGenerationProvenance,
} from "@/server/content/generation-state";
import {
  contentAssetIdSchema,
  contentAssetSchema,
  listContentAssetsSchema,
  listKeywordOpportunitiesSchema,
  selectKeywordOpportunitySchema,
  updateContentAssetSchema,
} from "@/server/schemas/content";
import type {
  ContentAsset,
  ContentAssetType,
  KeywordOpportunity,
} from "@/server/schemas/content";
import type { MarketingBrief } from "@/server/schemas/brief";
import {
  isGhostPublishingConfigured,
  publishContentAssetToGhost,
  type GhostPublishingCredentials,
} from "@/server/publishing/ghost-adapter";
import {
  isWebflowPublishingConfigured,
  publishContentAssetToWebflow,
  type WebflowPublishingCredentials,
} from "@/server/publishing/webflow-adapter";
import {
  isWordPressPublishingConfigured,
  publishContentAssetToWordPress,
  type WordPressPublishingCredentials,
} from "@/server/publishing/wordpress-adapter";
import { ConnectionsService } from "@/server/services/connections-service";
import { BriefService } from "@/server/services/brief-service";
import { PlanService } from "@/server/services/plan-service";
import { ProductService } from "@/server/services/product-service";

const contentAssetSelect =
  "id,product_id,brief_version,type,title,body_md,target_keyword,meta_title,meta_description,status,published_url,ai_confidence,provenance,created_at,updated_at";

export class ContentService {
  constructor(private readonly supabase: SupabaseClient) {}

  async listKeywordOpportunities(
    input: unknown,
  ): Promise<KeywordOpportunity[]> {
    const parsed = listKeywordOpportunitiesSchema.parse(input);
    await new ProductService(this.supabase).getProduct({
      productId: parsed.productId,
    });

    const brief = await new BriefService(this.supabase).getCurrentBrief({
      productId: parsed.productId,
    });
    if (!brief) {
      return [];
    }

    return deriveKeywordOpportunities(brief);
  }

  async selectKeywordOpportunity(input: unknown): Promise<ContentAsset> {
    const parsed = selectKeywordOpportunitySchema.parse(input);
    const { asset } = await this.getOrCreateContentAssetForKeywordOpportunity(parsed);
    return asset;
  }

  async selectKeywordOpportunityAndRequestGeneration(input: unknown): Promise<ContentAsset> {
    const parsed = selectKeywordOpportunitySchema.parse(input);
    const { asset, created } = await this.getOrCreateContentAssetForKeywordOpportunity(parsed);
    const generation = getContentGenerationState(asset.provenance);

    if (
      asset.bodyMd.trim() ||
      generation?.status === "queued" ||
      generation?.status === "running" ||
      generation?.status === "completed"
    ) {
      return asset;
    }

    return this.requestArticleGenerationForAsset(asset, { skipPlanCheck: created });
  }

  private async getOrCreateContentAssetForKeywordOpportunity(
    parsed: { productId: string; opportunityId: string },
  ): Promise<{ asset: ContentAsset; created: boolean }> {
    await new ProductService(this.supabase).getProduct({
      productId: parsed.productId,
    });

    const brief = await new BriefService(this.supabase).getCurrentBrief({
      productId: parsed.productId,
    });
    if (!brief) {
      throw new ContentAssetCreateError(
        "A Marketing Brief is required before selecting content opportunities.",
      );
    }

    const opportunity = deriveKeywordOpportunities(brief).find(
      (item) => item.id === parsed.opportunityId,
    );
    if (!opportunity) {
      throw new ContentAssetCreateError(
        "Selected keyword opportunity is no longer available.",
      );
    }

    const existing = await this.findActiveAssetForKeyword({
      productId: parsed.productId,
      targetKeyword: opportunity.targetKeyword,
    });

    if (existing) {
      return { asset: existing, created: false };
    }

    await new PlanService(this.supabase).assertCanUseGeneratedAction({
      productId: parsed.productId,
      actionLabel: "content asset creation",
    });

    const { data, error } = await this.supabase
      .from("content_assets")
      .insert({
        product_id: parsed.productId,
        brief_version: opportunity.briefVersion,
        type: opportunity.type,
        title: opportunity.title,
        body_md: "",
        target_keyword: opportunity.targetKeyword,
        meta_title: opportunity.title.slice(0, 70),
        meta_description: null,
        status: "draft",
        ai_confidence: null,
        provenance: {
          source: opportunity.source,
          clusterName: opportunity.clusterName,
          opportunityId: opportunity.id,
          selectedAt: new Date().toISOString(),
        },
      })
      .select(contentAssetSelect)
      .single();

    if (error) {
      throw new ContentAssetCreateError(error.message);
    }

    return { asset: mapContentAsset(data), created: true };
  }

  async listContentAssets(input: unknown): Promise<ContentAsset[]> {
    const parsed = listContentAssetsSchema.parse(input);
    await new ProductService(this.supabase).getProduct({
      productId: parsed.productId,
    });

    let query = this.supabase
      .from("content_assets")
      .select(contentAssetSelect)
      .eq("product_id", parsed.productId)
      .order("created_at", { ascending: false });

    if (parsed.status) {
      query = query.eq("status", parsed.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new ContentAssetReadError(error.message);
    }

    return data.map(mapContentAsset);
  }

  async getContentAsset(input: unknown): Promise<ContentAsset> {
    const parsed = contentAssetIdSchema.parse(input);

    const { data, error } = await this.supabase
      .from("content_assets")
      .select(contentAssetSelect)
      .eq("id", parsed.assetId)
      .single();

    if (error) {
      throw new ContentAssetReadError(error.message);
    }

    return mapContentAsset(data);
  }

  async updateContentAsset(input: unknown): Promise<ContentAsset> {
    const parsed = updateContentAssetSchema.parse(input);
    const current = await this.getContentAsset({ assetId: parsed.assetId });

    if (!["draft", "pending_review", "rejected"].includes(current.status)) {
      throw new ContentAssetUpdateError(
        "Only draft, pending review, or rejected content assets can be edited.",
      );
    }

    const { data, error } = await this.supabase
      .from("content_assets")
      .update({
        title: parsed.title,
        body_md: parsed.bodyMd,
        meta_title: parsed.metaTitle || null,
        meta_description: parsed.metaDescription || null,
      })
      .eq("id", parsed.assetId)
      .select(contentAssetSelect)
      .single();

    if (error) {
      throw new ContentAssetUpdateError(error.message);
    }

    return mapContentAsset(data);
  }

  async requestArticleGeneration(input: unknown): Promise<ContentAsset> {
    const parsed = contentAssetIdSchema.parse(input);
    const asset = await this.getContentAsset({ assetId: parsed.assetId });
    return this.requestArticleGenerationForAsset(asset);
  }

  async cancelArticleGeneration(input: unknown): Promise<ContentAsset> {
    const parsed = contentAssetIdSchema.parse(input);
    const asset = await this.getContentAsset({ assetId: parsed.assetId });
    const generation = getContentGenerationState(asset.provenance);

    if (generation?.status !== "queued" && generation?.status !== "running") {
      return asset;
    }

    const activeStep =
      generation.steps.find((step) => step.status === "running")?.label ??
      generation.steps.find((step) => step.status === "pending")?.label ??
      "Research search intent";

    const { data, error } = await this.supabase
      .from("content_assets")
      .update({
        status: "failed",
        provenance: {
          ...asset.provenance,
          generation: {
            status: "failed",
            progressPercent: generation.progressPercent,
            steps: buildContentGenerationSteps(activeStep).map((step) =>
              step.label === activeStep ? { ...step, status: "failed" as const } : step,
            ),
            requestedAt: generation.requestedAt,
            updatedAt: new Date().toISOString(),
            errorMessage: "Article generation was cancelled.",
          },
        },
      })
      .eq("id", asset.id)
      .select(contentAssetSelect)
      .single();

    if (error) {
      throw new ContentGenerationRequestError(error.message);
    }

    return mapContentAsset(data);
  }

  private async requestArticleGenerationForAsset(
    asset: ContentAsset,
    options: { skipPlanCheck?: boolean } = {},
  ): Promise<ContentAsset> {
    await new ProductService(this.supabase).getProduct({
      productId: asset.productId,
    });
    if (!options.skipPlanCheck) {
      await new PlanService(this.supabase).assertCanUseGeneratedAction({
        productId: asset.productId,
        actionLabel: "article generation",
      });
    }

    if (
      !["draft", "pending_review", "rejected", "failed"].includes(asset.status)
    ) {
      throw new ContentGenerationRequestError(
        "Only draft, pending review, rejected, or failed content assets can be regenerated.",
      );
    }

    const generation = getContentGenerationState(asset.provenance);
    if (generation?.status === "queued" || generation?.status === "running") {
      throw new ContentGenerationRequestError(
        "Article generation is already running for this draft.",
      );
    }

    const queued = await this.updateContentGenerationState({
      asset,
      generation: {
        status: "queued",
        progressPercent: 5,
        steps: buildContentGenerationSteps("Research search intent"),
        requestedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    try {
      await inngest.send({
        name: "content/generation.requested",
        data: {
          contentAssetId: asset.id,
          productId: asset.productId,
        },
      });
    } catch (error) {
      await this.updateContentGenerationState({
        asset: queued,
        generation: {
          status: "failed",
          progressPercent: 5,
          steps: buildContentGenerationSteps("Research search intent").map((step, index) =>
            index === 0 ? { ...step, status: "failed" } : step,
          ),
          requestedAt: getContentGenerationState(queued.provenance)?.requestedAt,
          updatedAt: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Content workflow could not be queued.",
        },
      });
      throw error;
    }

    return queued;
  }

  async publishToGhost(input: unknown): Promise<ContentAsset> {
    const parsed = contentAssetIdSchema.parse(input);
    const asset = await this.getContentAsset({ assetId: parsed.assetId });
    await new ProductService(this.supabase).getProduct({
      productId: asset.productId,
    });
    await new PlanService(this.supabase).assertCanExecuteAction({
      productId: asset.productId,
      actionLabel: "content publishing",
    });

    const credentials = await new ConnectionsService(this.supabase).getConnectedCredentials("ghost");
    if (!credentials && !isGhostPublishingConfigured()) {
      throw new ContentPublishError("Ghost publishing is not configured.");
    }

    if (!["approved", "pending_review"].includes(asset.status)) {
      throw new ContentPublishError(
        "Only approved or pending review content assets can be sent to Ghost as drafts.",
      );
    }

    const published = await publishContentAssetToGhost(asset, credentials as GhostPublishingCredentials);
    const provenance = {
      ...asset.provenance,
      ghost: {
        providerPostId: published.providerPostId,
        providerStatus: published.providerStatus,
        sentAt: new Date().toISOString(),
      },
    };

    const { data, error } = await this.supabase
      .from("content_assets")
      .update({
        status: "published",
        published_url: published.publishedUrl,
        provenance,
      })
      .eq("id", asset.id)
      .select(contentAssetSelect)
      .single();

    if (error) {
      throw new ContentPublishError(error.message);
    }

    return mapContentAsset(data);
  }

  async publishToWordPress(input: unknown): Promise<ContentAsset> {
    const parsed = contentAssetIdSchema.parse(input);
    const asset = await this.getContentAsset({ assetId: parsed.assetId });
    await new ProductService(this.supabase).getProduct({
      productId: asset.productId,
    });
    await new PlanService(this.supabase).assertCanExecuteAction({
      productId: asset.productId,
      actionLabel: "content publishing",
    });

    const credentials = await new ConnectionsService(this.supabase).getConnectedCredentials("wordpress");
    if (!credentials && !isWordPressPublishingConfigured()) {
      throw new ContentPublishError("WordPress publishing is not configured.");
    }

    if (!["approved", "pending_review"].includes(asset.status)) {
      throw new ContentPublishError(
        "Only approved or pending review content assets can be sent to WordPress as drafts.",
      );
    }

    const published = await publishContentAssetToWordPress(asset, credentials as WordPressPublishingCredentials);
    const provenance = {
      ...asset.provenance,
      wordpress: {
        providerPostId: published.providerPostId,
        providerStatus: published.providerStatus,
        sentAt: new Date().toISOString(),
      },
    };

    const { data, error } = await this.supabase
      .from("content_assets")
      .update({
        status: "published",
        published_url: published.publishedUrl,
        provenance,
      })
      .eq("id", asset.id)
      .select(contentAssetSelect)
      .single();

    if (error) {
      throw new ContentPublishError(error.message);
    }

    return mapContentAsset(data);
  }

  async publishToWebflow(input: unknown): Promise<ContentAsset> {
    const parsed = contentAssetIdSchema.parse(input);
    const asset = await this.getContentAsset({ assetId: parsed.assetId });
    await new ProductService(this.supabase).getProduct({
      productId: asset.productId,
    });
    await new PlanService(this.supabase).assertCanExecuteAction({
      productId: asset.productId,
      actionLabel: "content publishing",
    });

    const credentials = await new ConnectionsService(this.supabase).getConnectedCredentials("webflow");
    if (!credentials && !isWebflowPublishingConfigured()) {
      throw new ContentPublishError("Webflow publishing is not configured.");
    }

    if (!["approved", "pending_review"].includes(asset.status)) {
      throw new ContentPublishError(
        "Only approved or pending review content assets can be sent to Webflow as drafts.",
      );
    }

    const published = await publishContentAssetToWebflow(asset, credentials as WebflowPublishingCredentials);
    const provenance = {
      ...asset.provenance,
      webflow: {
        providerPostId: published.providerPostId,
        providerStatus: published.providerStatus,
        sentAt: new Date().toISOString(),
      },
    };

    const { data, error } = await this.supabase
      .from("content_assets")
      .update({
        status: "published",
        published_url: published.publishedUrl,
        provenance,
      })
      .eq("id", asset.id)
      .select(contentAssetSelect)
      .single();

    if (error) {
      throw new ContentPublishError(error.message);
    }

    return mapContentAsset(data);
  }

  private async findActiveAssetForKeyword(input: {
    productId: string;
    targetKeyword: string;
  }) {
    const { data, error } = await this.supabase
      .from("content_assets")
      .select(contentAssetSelect)
      .eq("product_id", input.productId)
      .eq("target_keyword", input.targetKeyword)
      .in("status", ["draft", "pending_review", "approved", "published"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new ContentAssetReadError(error.message);
    }

    return data ? mapContentAsset(data) : null;
  }

  private async updateContentGenerationState(input: {
    asset: ContentAsset;
    generation: ContentGenerationProvenance;
  }) {
    const { data, error } = await this.supabase
      .from("content_assets")
      .update({
        provenance: {
          ...input.asset.provenance,
          generation: input.generation,
        },
      })
      .eq("id", input.asset.id)
      .select(contentAssetSelect)
      .single();

    if (error) {
      throw new ContentGenerationRequestError(error.message);
    }

    return mapContentAsset(data);
  }
}

export class ContentAssetCreateError extends Error {
  constructor(message: string) {
    super(`Content asset could not be created: ${message}`);
    this.name = "ContentAssetCreateError";
  }
}

export class ContentAssetReadError extends Error {
  constructor(message: string) {
    super(`Content assets could not be loaded: ${message}`);
    this.name = "ContentAssetReadError";
  }
}

export class ContentAssetUpdateError extends Error {
  constructor(message: string) {
    super(`Content asset could not be updated: ${message}`);
    this.name = "ContentAssetUpdateError";
  }
}

export class ContentGenerationRequestError extends Error {
  constructor(message: string) {
    super(`Content generation could not be requested: ${message}`);
    this.name = "ContentGenerationRequestError";
  }
}

export class ContentPublishError extends Error {
  constructor(message: string) {
    super(`Content asset could not be published: ${message}`);
    this.name = "ContentPublishError";
  }
}

function deriveKeywordOpportunities(
  brief: MarketingBrief,
): KeywordOpportunity[] {
  const opportunities: KeywordOpportunity[] = [];

  brief.keywordClusters.forEach((cluster, clusterIndex) => {
    cluster.keywords.forEach((keyword, keywordIndex) => {
      const normalizedKeyword = normalizeKeyword(keyword);
      if (!normalizedKeyword) {
        return;
      }

      opportunities.push({
        id: createOpportunityId(
          "keyword_cluster",
          clusterIndex,
          keywordIndex,
          normalizedKeyword,
        ),
        productId: brief.productId,
        briefVersion: brief.version,
        source: "keyword_cluster",
        clusterName: cluster.name,
        title: `${titleCase(normalizedKeyword)} guide`,
        targetKeyword: normalizedKeyword,
        type: keywordTypeFromText(normalizedKeyword),
        rationale: `Derived from the "${cluster.name}" keyword cluster in the current Marketing Brief.`,
        priorityScore: Math.max(60, 92 - clusterIndex * 8 - keywordIndex * 4),
      });
    });
  });

  brief.contentCalendarSeed.forEach((seed, seedIndex) => {
    const targetKeyword = normalizeKeyword(seed.title);
    if (!targetKeyword) {
      return;
    }

    opportunities.push({
      id: createOpportunityId(
        "content_calendar_seed",
        seedIndex,
        0,
        targetKeyword,
      ),
      productId: brief.productId,
      briefVersion: brief.version,
      source: "content_calendar_seed",
      clusterName: null,
      title: seed.title,
      targetKeyword,
      type: contentTypeFromFormat(seed.format),
      rationale: seed.rationale,
      priorityScore: Math.max(55, 86 - seedIndex * 6),
    });
  });

  return dedupeByKeyword(opportunities).sort(
    (a, b) => b.priorityScore - a.priorityScore,
  );
}

function mapContentAsset(data: {
  id: string;
  product_id: string;
  brief_version: number;
  type: string;
  title: string;
  body_md: string;
  target_keyword: string | null;
  meta_title: string | null;
  meta_description: string | null;
  status: string;
  published_url: string | null;
  ai_confidence: number | string | null;
  provenance: unknown;
  created_at: string;
  updated_at: string;
}) {
  return contentAssetSchema.parse({
    id: data.id,
    productId: data.product_id,
    briefVersion: data.brief_version,
    type: data.type,
    title: data.title,
    bodyMd: data.body_md,
    targetKeyword: data.target_keyword,
    metaTitle: data.meta_title,
    metaDescription: data.meta_description,
    status: data.status,
    publishedUrl: data.published_url,
    aiConfidence:
      data.ai_confidence === null ? null : Number(data.ai_confidence),
    provenance: data.provenance,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}

function dedupeByKeyword(opportunities: KeywordOpportunity[]) {
  const seen = new Set<string>();
  return opportunities.filter((opportunity) => {
    const key = opportunity.targetKeyword.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function createOpportunityId(
  source: string,
  primaryIndex: number,
  secondaryIndex: number,
  keyword: string,
) {
  return `${source}-${primaryIndex}-${secondaryIndex}-${slugify(keyword)}`;
}

function contentTypeFromFormat(format: string): ContentAssetType {
  const normalized = format.toLowerCase();
  if (normalized.includes("comparison") || normalized.includes(" vs ")) {
    return "comparison";
  }

  if (normalized.includes("faq")) {
    return "faq";
  }

  if (normalized.includes("changelog") || normalized.includes("update")) {
    return "changelog";
  }

  return "article";
}

function keywordTypeFromText(keyword: string): ContentAssetType {
  if (keyword.includes(" vs ") || keyword.includes("alternative")) {
    return "comparison";
  }

  return "article";
}

function normalizeKeyword(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function slugify(value: string) {
  return normalizeKeyword(value).replace(/\s+/g, "-").slice(0, 160);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
