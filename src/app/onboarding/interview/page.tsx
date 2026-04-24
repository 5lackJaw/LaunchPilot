import type { Metadata } from "next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";
import { InterviewFlow } from "@/app/onboarding/interview/interview-flow";

export const metadata: Metadata = {
  title: "Product interview",
};

type PageProps = {
  searchParams: Promise<{
    productId?: string;
  }>;
};

export default async function OnboardingInterviewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = params.productId ? await loadProduct(params.productId) : { product: null, error: "Missing product ID." };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between border-b pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-xs font-medium text-primary-foreground">
              LP
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Onboarding</p>
              <h1 className="font-serif text-2xl italic">Product interview</h1>
            </div>
          </div>
          <Badge variant="secondary">Step 2</Badge>
        </header>

        <section className="flex flex-1 flex-col gap-6 py-8">
          {data.error ? (
            <Alert variant="destructive">
              <AlertTitle>Interview could not be loaded</AlertTitle>
              <AlertDescription>{data.error}</AlertDescription>
            </Alert>
          ) : null}

          {data.product ? (
            <>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Product</p>
                <h2 className="text-lg font-medium">{data.product.name}</h2>
                <p className="text-sm text-muted-foreground">{data.product.url}</p>
              </div>
              <InterviewFlow productId={data.product.id} />
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

async function loadProduct(productId: string): Promise<{ product: Product | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getProduct({ productId });

    return { product, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, error: error.message };
    }

    if (error instanceof ProductReadError) {
      return { product: null, error: error.message };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}
