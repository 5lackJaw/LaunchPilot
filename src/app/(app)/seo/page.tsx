import { ArrowRight, FileText, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AppTopbar } from "@/components/layout/app-topbar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { selectKeywordOpportunityAction } from "@/app/(app)/seo/actions";
import type { ContentAsset, KeywordOpportunity } from "@/server/schemas/content";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { ContentAssetReadError, ContentService } from "@/server/services/content-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{
    selected?: string;
    selectionError?: string;
  }>;
};

export default async function SeoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadSeoData();

  if (data.authRequired) {
    return (
      <main className="flex min-h-screen flex-col">
        <AppTopbar title="SEO Content" eyebrow="Keyword opportunities" />
        <div className="p-6">
          <EmptyState
            icon={Search}
            title="Sign in required"
            description="Sign in before selecting keyword opportunities."
          />
        </div>
      </main>
    );
  }

  if (data.error) {
    return (
      <main className="flex min-h-screen flex-col">
        <AppTopbar title="SEO Content" eyebrow="Keyword opportunities" />
        <div className="p-6">
          <Alert variant="destructive">
            <AlertTitle>SEO content could not be loaded</AlertTitle>
            <AlertDescription>{data.error}</AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar
        title="SEO Content"
        eyebrow={data.product ? `Keyword opportunities / ${data.product.name}` : "Keyword opportunities"}
        actions={<Badge variant="secondary">{data.opportunities.length} opportunities</Badge>}
      />

      <section className="grid gap-4 p-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          {params.selected ? (
            <Alert>
              <AlertTitle>Content draft queued</AlertTitle>
              <AlertDescription>The selected keyword now has a durable content asset placeholder for the generation workflow.</AlertDescription>
            </Alert>
          ) : null}
          {params.selectionError ? (
            <Alert variant="destructive">
              <AlertTitle>Selection failed</AlertTitle>
              <AlertDescription>{params.selectionError}</AlertDescription>
            </Alert>
          ) : null}

          {data.product ? (
            data.opportunities.length ? (
              data.opportunities.map((opportunity) => (
                <OpportunityCard key={opportunity.id} opportunity={opportunity} />
              ))
            ) : (
              <EmptyState
                icon={Search}
                title="No keyword opportunities yet"
                description="Complete the Marketing Brief first. Keyword clusters and content seeds from the brief will appear here."
              />
            )
          ) : (
            <EmptyState
              icon={Search}
              title="No product available"
              description="Create a product during onboarding before planning SEO content."
            />
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline state</CardTitle>
              <CardDescription>Selected opportunities become content assets before article generation starts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Metric label="Draft assets" value={String(data.recentAssets.filter((asset) => asset.status === "draft").length)} />
              <Metric label="Pending review" value={String(data.recentAssets.filter((asset) => asset.status === "pending_review").length)} />
              <Metric label="Published" value={String(data.recentAssets.filter((asset) => asset.status === "published").length)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent selections</CardTitle>
              <CardDescription>Durable records created from this flow.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.recentAssets.length ? (
                data.recentAssets.slice(0, 5).map((asset) => (
                  <div key={asset.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                    <p className="truncate text-sm font-medium">{asset.title}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {asset.targetKeyword ?? "No keyword"} - {asset.status}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No content assets selected yet.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}

function OpportunityCard({ opportunity }: { opportunity: KeywordOpportunity }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{opportunity.type}</Badge>
              <Badge variant={opportunity.priorityScore >= 80 ? "success" : "outline"}>{opportunity.priorityScore} priority</Badge>
              {opportunity.clusterName ? <Badge variant="outline">{opportunity.clusterName}</Badge> : null}
            </div>
            <CardTitle className="truncate text-base">{opportunity.title}</CardTitle>
            <CardDescription>{opportunity.rationale}</CardDescription>
          </div>
          <Search className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{opportunity.targetKeyword}</span>
        <form action={selectKeywordOpportunityAction}>
          <input type="hidden" name="productId" value={opportunity.productId} />
          <input type="hidden" name="opportunityId" value={opportunity.id} />
          <Button type="submit" size="sm">
            Select
            <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
      <span className="flex items-center gap-2 text-muted-foreground">
        <FileText className="size-4" aria-hidden="true" />
        {label}
      </span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

async function loadSeoData(): Promise<{
  product: Product | null;
  opportunities: KeywordOpportunity[];
  recentAssets: ContentAsset[];
  error: string | null;
  authRequired: boolean;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, opportunities: [], recentAssets: [], error: null, authRequired: false };
    }

    const contentService = new ContentService(supabase);
    const [opportunities, recentAssets] = await Promise.all([
      contentService.listKeywordOpportunities({ productId: product.id }),
      contentService.listContentAssets({ productId: product.id }),
    ]);

    return { product, opportunities, recentAssets, error: null, authRequired: false };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, opportunities: [], recentAssets: [], error: null, authRequired: true };
    }

    if (error instanceof ProductReadError || error instanceof ContentAssetReadError) {
      return { product: null, opportunities: [], recentAssets: [], error: error.message, authRequired: false };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        opportunities: [],
        recentAssets: [],
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
        authRequired: false,
      };
    }

    throw error;
  }
}
