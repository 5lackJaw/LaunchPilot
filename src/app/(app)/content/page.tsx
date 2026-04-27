import { ArrowRight, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AppTopbar } from "@/components/layout/app-topbar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ContentAsset } from "@/server/schemas/content";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { ContentAssetReadError, ContentService } from "@/server/services/content-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

export default async function ContentPage() {
  const data = await loadContentData();

  if (data.authRequired) {
    return <ContentShell title="Content Library" eyebrow="Generated assets" errorTitle="Sign in required" error="Sign in before viewing content assets." />;
  }

  if (data.error) {
    return <ContentShell title="Content Library" eyebrow="Generated assets" errorTitle="Content could not be loaded" error={data.error} destructive />;
  }

  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar
        title="Content Library"
        eyebrow={data.product ? `Generated assets / ${data.product.name}` : "Generated assets"}
        actions={
          <Button size="sm" asChild>
            <Link href="/seo">
              <Plus />
              New article
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 p-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          {data.product ? (
            data.assets.length ? (
              data.assets.map((asset) => <ContentAssetCard key={asset.id} asset={asset} />)
            ) : (
              <EmptyState
                icon={FileText}
                title="No content assets yet"
                description="Select a keyword opportunity to create the first durable draft record."
                action={
                  <Button size="sm" asChild>
                    <Link href="/seo">
                      Open SEO opportunities
                      <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                }
              />
            )
          ) : (
            <EmptyState
              icon={FileText}
              title="No product available"
              description="Create a product during onboarding before building content assets."
            />
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Library state</CardTitle>
              <CardDescription>Current content asset lifecycle counts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Metric label="Draft" value={countByStatus(data.assets, "draft")} />
              <Metric label="Pending review" value={countByStatus(data.assets, "pending_review")} />
              <Metric label="Approved" value={countByStatus(data.assets, "approved")} />
              <Metric label="Published" value={countByStatus(data.assets, "published")} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add content</CardTitle>
              <CardDescription>Select a keyword opportunity to generate a new article draft.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" className="w-full">
                <Link href="/seo">
                  Find keyword opportunities
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}

function ContentAssetCard({ asset }: { asset: ContentAsset }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{asset.type}</Badge>
              <Badge variant={asset.status === "published" ? "success" : asset.status === "failed" ? "danger" : "outline"}>{asset.status}</Badge>
              {asset.aiConfidence !== null ? <Badge variant="outline">{Math.round(asset.aiConfidence * 100)}% confidence</Badge> : null}
            </div>
            <CardTitle className="truncate text-base">{asset.title}</CardTitle>
            <CardDescription>{asset.targetKeyword ?? "No target keyword"}</CardDescription>
          </div>
          <FileText className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <span className="font-mono text-xs text-muted-foreground">Brief v{asset.briefVersion}</span>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/content/${asset.id}`}>
            Open editor
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

function countByStatus(assets: ContentAsset[], status: ContentAsset["status"]) {
  return String(assets.filter((asset) => asset.status === status).length);
}

function ContentShell({
  title,
  eyebrow,
  errorTitle,
  error,
  destructive,
}: {
  title: string;
  eyebrow: string;
  errorTitle: string;
  error: string;
  destructive?: boolean;
}) {
  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar title={title} eyebrow={eyebrow} />
      <div className="p-6">
        <Alert variant={destructive ? "destructive" : "default"}>
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    </main>
  );
}

async function loadContentData(): Promise<{
  product: Product | null;
  assets: ContentAsset[];
  error: string | null;
  authRequired: boolean;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, assets: [], error: null, authRequired: false };
    }

    const assets = await new ContentService(supabase).listContentAssets({ productId: product.id });
    return { product, assets, error: null, authRequired: false };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, assets: [], error: null, authRequired: true };
    }

    if (error instanceof ProductReadError || error instanceof ContentAssetReadError) {
      return { product: null, assets: [], error: error.message, authRequired: false };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        assets: [],
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
        authRequired: false,
      };
    }

    throw error;
  }
}
