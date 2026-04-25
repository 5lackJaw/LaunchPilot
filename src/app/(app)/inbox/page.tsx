import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InboxAuthRequired } from "@/app/(app)/inbox/auth-required";
import { InboxClient } from "@/app/(app)/inbox/inbox-client";
import type { InboxItem } from "@/server/schemas/inbox";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { InboxItemReadError, InboxService } from "@/server/services/inbox-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{
    productId?: string;
    batchApproved?: string;
    batchError?: string;
  }>;
};

export default async function InboxPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadInboxData(params.productId);

  return (
    <>
      {data.authRequired ? (
        <InboxAuthRequired />
      ) : data.error ? (
        <main className="flex min-h-screen flex-col">
          <div className="p-6">
            <Alert variant="destructive">
              <AlertTitle>Inbox could not be loaded</AlertTitle>
              <AlertDescription>{data.error}</AlertDescription>
            </Alert>
          </div>
        </main>
      ) : (
        <InboxClient items={data.items} product={data.product} batchApproved={params.batchApproved} batchError={params.batchError} />
      )}
    </>
  );
}

async function loadInboxData(productId?: string): Promise<{
  product: Product | null;
  items: InboxItem[];
  error: string | null;
  authRequired: boolean;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const productService = new ProductService(supabase);
    const product = productId ? await productService.getProduct({ productId }) : await productService.getLatestProduct();

    if (!product) {
      return { product: null, items: [], error: null, authRequired: false };
    }

    const items = await new InboxService(supabase).listItems({
      productId: product.id,
      status: "pending",
    });

    return { product, items, error: null, authRequired: false };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, items: [], error: null, authRequired: true };
    }

    if (error instanceof ProductReadError || error instanceof InboxItemReadError) {
      return { product: null, items: [], error: error.message, authRequired: false };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        items: [],
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
        authRequired: false,
      };
    }

    throw error;
  }
}
