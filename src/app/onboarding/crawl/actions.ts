"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/server/services/auth-service";
import { CrawlStartError, CrawlService } from "@/server/services/crawl-service";
import { ProductCreateError, ProductService } from "@/server/services/product-service";

export type ProductCreateFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: {
    name?: string[];
    url?: string[];
  };
};

export type CrawlStartFormState = {
  status: "idle" | "error";
  message?: string;
};

export async function createProductAction(
  _previousState: ProductCreateFormState,
  formData: FormData,
): Promise<ProductCreateFormState> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).createProduct({
      name: formData.get("name"),
      url: formData.get("url"),
    });

    redirect(`/onboarding/crawl?productId=${product.id}&created=1`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof ZodError) {
      const flattened = error.flatten();

      return {
        status: "error",
        message: "Check the product details and try again.",
        fieldErrors: flattened.fieldErrors,
      };
    }

    if (error instanceof AuthRequiredError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    if (error instanceof ProductCreateError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        status: "error",
        message: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local before creating products.",
      };
    }

    throw error;
  }
}

export async function startCrawlAction(
  _previousState: CrawlStartFormState,
  formData: FormData,
): Promise<CrawlStartFormState> {
  const productId = formData.get("productId");

  try {
    const supabase = await createSupabaseServerClient();
    const job = await new CrawlService(supabase).startCrawl({ productId });

    redirect(`/onboarding/crawl?productId=${job.productId}&crawlJobId=${job.id}`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof ZodError) {
      return {
        status: "error",
        message: "The product ID was not valid. Reload the page and try again.",
      };
    }

    if (error instanceof AuthRequiredError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    if (error instanceof CrawlStartError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        status: "error",
        message: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local before starting crawls.",
      };
    }

    if (error instanceof Error && error.message.toLowerCase().includes("inngest")) {
      return {
        status: "error",
        message: "The crawl job was created, but the workflow event could not be sent. Check Inngest environment settings before retrying.",
      };
    }

    throw error;
  }
}

function isRedirectError(error: unknown) {
  return error instanceof Error && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT");
}
