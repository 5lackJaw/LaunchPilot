"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/server/services/auth-service";
import { CrawlService, CrawlStartError } from "@/server/services/crawl-service";
import { PlanLimitError } from "@/server/services/plan-service";
import {
  DuplicateProductError,
  ProductCreateError,
  ProductDeleteError,
  ProductReadError,
  ProductService,
  ProductUpdateError,
} from "@/server/services/product-service";

export async function createProductFromSettingsAction(formData: FormData) {
  let redirectTo = "/settings/products";

  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).createProduct({
      name: formData.get("name"),
      url: formData.get("url"),
    });

    revalidateProductPaths();
    redirectTo = `/settings/products?created=1&productId=${product.id}`;
  } catch (error) {
    if (error instanceof DuplicateProductError) {
      redirectTo = `/settings/products?duplicate=1&productId=${error.productId}`;
    } else {
      redirectTo = `/settings/products?createError=${encodeURIComponent(toProductMessage(error))}`;
    }
  }

  redirect(redirectTo);
}

export async function updateProductAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  let redirectTo = "/settings/products";

  try {
    const supabase = await createSupabaseServerClient();
    await new ProductService(supabase).updateProduct({
      productId,
      name: formData.get("name"),
      url: formData.get("url"),
    });

    revalidateProductPaths();
    redirectTo = `/settings/products?saved=1&productId=${productId}`;
  } catch (error) {
    if (error instanceof DuplicateProductError) {
      redirectTo = `/settings/products?duplicate=1&productId=${error.productId}`;
    } else {
      redirectTo = `/settings/products?saveError=${encodeURIComponent(toProductMessage(error))}`;
    }
  }

  redirect(redirectTo);
}

export async function setActiveProductAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  let redirectTo = "/settings/products";

  try {
    const supabase = await createSupabaseServerClient();
    await new ProductService(supabase).setActiveProduct({ productId });

    revalidateProductPaths();
    redirectTo = `/settings/products?active=1&productId=${productId}`;
  } catch (error) {
    redirectTo = `/settings/products?activeError=${encodeURIComponent(toProductMessage(error))}`;
  }

  redirect(redirectTo);
}

export async function crawlProductFromSettingsAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  let redirectTo = "/settings/products";

  try {
    const supabase = await createSupabaseServerClient();
    const job = await new CrawlService(supabase).startCrawl({ productId });

    revalidateProductPaths();
    redirectTo = `/settings/products?crawlStarted=1&productId=${job.productId}&crawlJobId=${job.id}`;
  } catch (error) {
    redirectTo = `/settings/products?crawlError=${encodeURIComponent(toProductMessage(error))}`;
  }

  redirect(redirectTo);
}

export async function deleteProductAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  const productName = String(formData.get("productName") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  let redirectTo = "/settings/products";

  try {
    if (confirmation !== productName) {
      throw new ProductDeleteError("Type the product name exactly to confirm deletion.");
    }

    const supabase = await createSupabaseServerClient();
    await new ProductService(supabase).deleteProduct({ productId });

    revalidateProductPaths();
    redirectTo = "/settings/products?deleted=1";
  } catch (error) {
    redirectTo = `/settings/products?deleteError=${encodeURIComponent(toProductMessage(error))}&productId=${productId}`;
  }

  redirect(redirectTo);
}

function revalidateProductPaths() {
  revalidatePath("/settings/products");
  revalidatePath("/dashboard");
  revalidatePath("/inbox");
  revalidatePath("/marketing-brief");
  revalidatePath("/seo");
  revalidatePath("/content");
  revalidatePath("/analytics");
}

function toProductMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the product details and try again.";
  }

  if (error instanceof AuthRequiredError) {
    return error.message;
  }

  if (
    error instanceof ProductReadError ||
    error instanceof ProductCreateError ||
    error instanceof ProductUpdateError ||
    error instanceof ProductDeleteError ||
    error instanceof CrawlStartError ||
    error instanceof PlanLimitError
  ) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return "Supabase is not configured yet.";
  }

  if (error instanceof Error && error.message.toLowerCase().includes("inngest")) {
    return "The crawl job could not be sent to the workflow runner. Check Inngest settings.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Product action failed.";
}
