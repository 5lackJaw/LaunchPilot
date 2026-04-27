import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthService } from "@/server/services/auth-service";
import {
  createProductSchema,
  productIdSchema,
  productSchema,
} from "@/server/schemas/product";
import { PlanService } from "@/server/services/plan-service";

const productSelect = "id,user_id,name,url,status,current_marketing_brief_id,created_at";

export class ProductService {
  constructor(private readonly supabase: SupabaseClient) {}

  async createProduct(input: unknown) {
    const parsed = createProductSchema.parse(input);
    const user = await new AuthService(this.supabase).requireUser();
    const duplicate = await this.findDuplicateByUrl(parsed.url);

    if (duplicate) {
      throw new DuplicateProductError(duplicate.id, duplicate.name, duplicate.url);
    }

    await new PlanService(this.supabase).assertCanCreateProduct();

    const { data, error } = await this.supabase
      .from("products")
      .insert({
        user_id: user.id,
        name: parsed.name,
        url: parsed.url,
        status: "onboarding",
      })
      .select(productSelect)
      .single();

    if (error) {
      throw new ProductCreateError(error.message);
    }

    return mapProduct(data);
  }

  async getProduct(input: unknown) {
    const { productId } = productIdSchema.parse(input);
    await new AuthService(this.supabase).requireUser();

    const { data, error } = await this.supabase
      .from("products")
      .select(productSelect)
      .eq("id", productId)
      .single();

    if (error) {
      throw new ProductReadError(error.message);
    }

    return mapProduct(data);
  }

  async getLatestProduct() {
    await new AuthService(this.supabase).requireUser();

    const { data, error } = await this.supabase
      .from("products")
      .select(productSelect)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new ProductReadError(error.message);
    }

    return data ? mapProduct(data) : null;
  }

  async listProducts() {
    await new AuthService(this.supabase).requireUser();

    const { data, error } = await this.supabase
      .from("products")
      .select(productSelect)
      .order("created_at", { ascending: false });

    if (error) {
      throw new ProductReadError(error.message);
    }

    return data.map(mapProduct);
  }

  private async findDuplicateByUrl(url: string) {
    const products = await this.listProducts();
    const normalizedUrl = normalizeProductUrl(url);

    return products.find((product) => normalizeProductUrl(product.url) === normalizedUrl) ?? null;
  }
}

export function normalizeProductUrl(value: string) {
  const url = new URL(value.trim());
  url.hash = "";
  url.search = "";
  url.hostname = url.hostname.toLowerCase();
  url.protocol = url.protocol.toLowerCase();

  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }

  url.pathname = url.pathname.replace(/\/+$/, "") || "/";

  return url.toString();
}

function mapProduct(data: {
  id: string;
  user_id: string;
  name: string;
  url: string;
  status: string;
  current_marketing_brief_id: string | null;
  created_at: string;
}) {
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

export class DuplicateProductError extends Error {
  constructor(
    readonly productId: string,
    readonly productName: string,
    readonly productUrl: string,
  ) {
    super(`Product already exists: ${productName} (${productUrl})`);
    this.name = "DuplicateProductError";
  }
}
