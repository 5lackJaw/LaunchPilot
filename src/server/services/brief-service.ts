import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import { marketingBriefSchema } from "@/server/schemas/brief";
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
