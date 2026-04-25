import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import { buildInitialBrief } from "@/server/brief/build-initial-brief";
import { editMarketingBriefSchema, marketingBriefSchema } from "@/server/schemas/brief";
import type { MarketingBrief } from "@/server/schemas/brief";
import { productIdSchema } from "@/server/schemas/product";
import { AuthService } from "@/server/services/auth-service";
import { ProductService } from "@/server/services/product-service";

export class BriefService {
  constructor(private readonly supabase: SupabaseClient) {}

  async requestGeneration(input: unknown) {
    const { productId } = productIdSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId });

    await inngest.send({
      name: "brief/generation.requested",
      data: {
        productId,
      },
    });

    return { productId };
  }

  async generateInitialBriefNow(input: unknown): Promise<MarketingBrief> {
    const { productId } = productIdSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId });

    const [productResult, crawlResult, answersResult, versionResult] = await Promise.all([
      this.supabase.from("products").select("id,name,url").eq("id", productId).single(),
      this.supabase
        .from("crawl_results")
        .select("id,page_title,meta_description,h1,created_at")
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

    const brief = buildInitialBrief({
      product: productResult.data,
      crawl: crawlResult.data,
      answers: answersResult.data,
      nextVersion: (versionResult.data[0]?.version ?? 0) + 1,
    });

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

  async createEditedVersion(input: unknown): Promise<MarketingBrief> {
    const parsed = editMarketingBriefSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId: parsed.productId });
    const currentBrief = await this.getCurrentBrief({ productId: parsed.productId });

    if (!currentBrief) {
      throw new BriefEditError("No current Marketing Brief exists for this product.");
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
}

export class BriefGenerationRequestError extends Error {
  constructor(message: string) {
    super(`Brief generation could not be requested: ${message}`);
    this.name = "BriefGenerationRequestError";
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
