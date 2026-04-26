import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthService } from "@/server/services/auth-service";
import {
  createProductSchema,
  productIdSchema,
  productSchema,
} from "@/server/schemas/product";
import { PlanService } from "@/server/services/plan-service";

export class ProductService {
  constructor(private readonly supabase: SupabaseClient) {}

  async createProduct(input: unknown) {
    const parsed = createProductSchema.parse(input);
    const user = await new AuthService(this.supabase).requireUser();
    await new PlanService(this.supabase).assertCanCreateProduct();

    const { data, error } = await this.supabase
      .from("products")
      .insert({
        user_id: user.id,
        name: parsed.name,
        url: parsed.url,
        status: "onboarding",
      })
      .select(
        "id,user_id,name,url,status,current_marketing_brief_id,created_at",
      )
      .single();

    if (error) {
      throw new ProductCreateError(error.message);
    }

    return productSchema.parse({
      id: data.id,
      userId: data.user_id,
      name: data.name,
      url: data.url,
      status: data.status,
      currentMarketingBriefId: data.current_marketing_brief_id,
      createdAt: data.created_at,
    });
  }

  async getProduct(input: unknown) {
    const { productId } = productIdSchema.parse(input);
    await new AuthService(this.supabase).requireUser();

    const { data, error } = await this.supabase
      .from("products")
      .select(
        "id,user_id,name,url,status,current_marketing_brief_id,created_at",
      )
      .eq("id", productId)
      .single();

    if (error) {
      throw new ProductReadError(error.message);
    }

    return productSchema.parse({
      id: data.id,
      userId: data.user_id,
      name: data.name,
      url: data.url,
      status: data.status,
      currentMarketingBriefId: data.current_marketing_brief_id,
      createdAt: data.created_at,
    });
  }

  async getLatestProduct() {
    await new AuthService(this.supabase).requireUser();

    const { data, error } = await this.supabase
      .from("products")
      .select(
        "id,user_id,name,url,status,current_marketing_brief_id,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new ProductReadError(error.message);
    }

    return data
      ? productSchema.parse({
          id: data.id,
          userId: data.user_id,
          name: data.name,
          url: data.url,
          status: data.status,
          currentMarketingBriefId: data.current_marketing_brief_id,
          createdAt: data.created_at,
        })
      : null;
  }
}

export class ProductCreateError extends Error {
  constructor(message: string) {
    super(`Product could not be created: ${message}`);
    this.name = "ProductCreateError";
  }
}

export class ProductReadError extends Error {
  constructor(message: string) {
    super(`Product could not be loaded: ${message}`);
    this.name = "ProductReadError";
  }
}
