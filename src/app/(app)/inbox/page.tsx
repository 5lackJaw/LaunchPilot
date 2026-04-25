import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InboxClient } from "@/app/(app)/inbox/inbox-client";
import type { InboxItem } from "@/server/schemas/inbox";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { InboxItemReadError, InboxService } from "@/server/services/inbox-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{
    productId?: string;
  }>;
};

export default async function InboxPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadInboxData(params.productId);

  return (
    <>
      {data.error ? (
        <main className="flex min-h-screen flex-col">
          <div className="p-6">
            <Alert variant="destructive">
              <AlertTitle>Inbox could not be loaded</AlertTitle>
              <AlertDescription>{data.error}</AlertDescription>
            </Alert>
          </div>
        </main>
      ) : (
        <InboxClient items={data.items} product={data.product} />
      )}
    </>
  );
}

async function loadInboxData(productId?: string): Promise<{
  product: Product | null;
  items: InboxItem[];
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const productService = new ProductService(supabase);
    const product = productId ? await productService.getProduct({ productId }) : await productService.getLatestProduct();

    if (!product) {
      return { product: null, items: [], error: null };
    }

    const items = await new InboxService(supabase).listItems({
      productId: product.id,
      status: "pending",
    });

    return { product, items, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, items: [], error: error.message };
    }

    if (error instanceof ProductReadError || error instanceof InboxItemReadError) {
      return { product: null, items: [], error: error.message };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        items: [],
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}
