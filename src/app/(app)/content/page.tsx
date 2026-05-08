import { Download, FileText, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AppTopbar } from "@/components/layout/app-topbar";
import { WorkflowStatusRefresh } from "@/components/workflow-status-refresh";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GenerateArticleModal } from "@/app/(app)/content/generate-article-modal";
import { selectKeywordOpportunityAction } from "@/app/(app)/seo/actions";
import { DraftOpportunitySubmit } from "@/app/(app)/seo/draft-opportunity-submit";
import { getContentGenerationState } from "@/server/content/generation-state";
import type { ContentAsset, KeywordOpportunity } from "@/server/schemas/content";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { ContentAssetReadError, ContentService } from "@/server/services/content-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{ selectionError?: string; generationRequested?: string }>;
};

type KeywordStatus = "not_queued" | "queued" | "drafting" | "in_inbox" | "published" | "rejected";

export default async function ContentPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadContentData();
  const running = data.assets.some((asset) => {
    const generation = getContentGenerationState(asset.provenance);
    return generation?.status === "queued" || generation?.status === "running";
  });

  if (data.authRequired) {
    return <ContentShell title="Content" eyebrow="Autopilot" errorTitle="Sign in required" error="Sign in before viewing content." />;
  }

  if (data.error) {
    return <ContentShell title="Content" eyebrow="Autopilot" errorTitle="Content could not be loaded" error={data.error} destructive />;
  }

  const csvHref = createKeywordCsvHref(data.opportunities);
  const unqueued = data.opportunities.filter((opportunity) => getKeywordStatus(opportunity, data.assets) === "not_queued");
  const clusters = groupOpportunities(data.opportunities);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background">
      <WorkflowStatusRefresh enabled={running} />
      <AppTopbar
        title="Content"
        eyebrow={data.product ? `Autopilot / ${data.product.name}` : "Autopilot"}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild disabled={!data.opportunities.length}>
              <a href={csvHref} download="launchbeacon-keywords.csv">
                <Download />
                Export keywords
              </a>
            </Button>
            <Button size="sm" variant="outline" disabled title="Keyword research refresh is not wired yet.">
              <RefreshCw />
              Refresh research
            </Button>
            {data.product ? <GenerateArticleModal productId={data.product.id} opportunities={unqueued} /> : null}
          </div>
        }
      />

      <section className="grid min-h-0 flex-1 grid-cols-[1fr_340px] overflow-hidden">
        <div className="flex min-w-0 flex-col gap-5 overflow-y-auto p-6">
          {params.selectionError ? (
            <Alert variant="destructive">
              <AlertTitle>Article generation could not start</AlertTitle>
              <AlertDescription>{params.selectionError}</AlertDescription>
            </Alert>
          ) : null}
          {params.generationRequested ? (
            <Alert>
              <AlertTitle>Article generation started</AlertTitle>
              <AlertDescription>The selected keyword is drafting in the background. This page updates while the workflow runs.</AlertDescription>
            </Alert>
          ) : null}

          {!data.product ? (
            <EmptyState icon={Search} title="No product available" description="Create a product during onboarding before planning content." />
          ) : data.opportunities.length ? (
            <KeywordOpportunityTable product={data.product} opportunities={data.opportunities} assets={data.assets} />
          ) : (
            <EmptyState
              icon={Search}
              title="No keyword opportunities yet"
              description="Complete the Marketing Brief to surface content opportunities from your product positioning."
            />
          )}

          <ContentLibrary assets={data.assets} />
        </div>

        <aside className="min-h-0 overflow-y-auto border-l bg-secondary/35 p-5">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline state</CardTitle>
              <CardDescription>Keyword lifecycle across this product.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Metric label="Not queued" value={countKeywords(data.opportunities, data.assets, "not_queued")} />
              <Metric label="Drafting" value={countKeywords(data.opportunities, data.assets, "drafting")} />
              <Metric label="In inbox" value={countKeywords(data.opportunities, data.assets, "in_inbox")} />
              <Metric label="Published" value={countKeywords(data.opportunities, data.assets, "published")} />
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Clusters</CardTitle>
              <CardDescription>Opportunity groups from the current Marketing Brief.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {clusters.length ? (
                clusters.map(([cluster, opportunities]) => (
                  <div key={cluster} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                    <span className="truncate">{cluster}</span>
                    <span className="font-mono text-xs text-muted-foreground">{opportunities.length}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No clusters yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>SEO settings</CardTitle>
              <CardDescription>Production settings remain server-authoritative.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ToggleRow label="Auto-publish drafts" on={false} />
              <ToggleRow label="Generate comparison pages" on />
              <ToggleRow label="Internal linking" on />
              <Button size="sm" variant="outline" className="w-full" asChild>
                <Link href="/settings/preferences">Configure settings</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}

function KeywordOpportunityTable({
  product,
  opportunities,
  assets,
}: {
  product: Product;
  opportunities: KeywordOpportunity[];
  assets: ContentAsset[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Keyword opportunities</CardTitle>
        <CardDescription>Ranked by realistic ranking probability from the current Marketing Brief.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y bg-secondary/60 text-left font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-4 py-3 font-normal">Keyword</th>
                <th className="px-4 py-3 text-right font-normal">Priority</th>
                <th className="px-4 py-3 font-normal">Difficulty</th>
                <th className="px-4 py-3 font-normal">Cluster</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 text-right font-normal">Action</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opportunity) => {
                const asset = assets.find((item) => item.targetKeyword === opportunity.targetKeyword) ?? null;
                const status = getKeywordStatus(opportunity, assets);

                return (
                  <tr key={opportunity.id} className="border-b">
                    <td className="px-4 py-3">
                      <Link
                        href={asset ? `/content/${asset.id}` : "#"}
                        className={asset ? "font-medium text-foreground hover:text-primary" : "font-medium text-foreground"}
                      >
                        {opportunity.targetKeyword}
                      </Link>
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">{opportunity.type}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{opportunity.priorityScore}</td>
                    <td className="px-4 py-3">
                      <DifficultyBadge priorityScore={opportunity.priorityScore} />
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-muted-foreground">{opportunity.clusterName ?? "Unclustered"}</td>
                    <td className="px-4 py-3">
                      <KeywordStatusBadge status={status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <KeywordAction productId={product.id} opportunity={opportunity} asset={asset} status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function KeywordAction({
  productId,
  opportunity,
  asset,
  status,
}: {
  productId: string;
  opportunity: KeywordOpportunity;
  asset: ContentAsset | null;
  status: KeywordStatus;
}) {
  if (status === "not_queued" || status === "rejected") {
    return (
      <form action={selectKeywordOpportunityAction}>
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="opportunityId" value={opportunity.id} />
        <DraftOpportunitySubmit label={status === "rejected" ? "Re-queue" : "+ Queue"} />
      </form>
    );
  }

  if (status === "queued") {
    return <span className="font-mono text-[11px] text-muted-foreground">Queued</span>;
  }

  if (status === "drafting") {
    return <span className="font-mono text-[11px] text-primary">Drafting...</span>;
  }

  if (status === "in_inbox") {
    return (
      <Button size="sm" variant="outline" asChild>
        <Link href="/inbox">Open in inbox</Link>
      </Button>
    );
  }

  if (status === "published" && asset?.publishedUrl) {
    return (
      <Button size="sm" variant="outline" asChild>
        <a href={asset.publishedUrl} target="_blank" rel="noreferrer">View</a>
      </Button>
    );
  }

  return asset ? (
    <Button size="sm" variant="outline" asChild>
      <Link href={`/content/${asset.id}`}>Open</Link>
    </Button>
  ) : null;
}

function ContentLibrary({ assets }: { assets: ContentAsset[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Content assets</CardTitle>
        <CardDescription>Generated, approved, and published articles for this product.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {assets.length ? (
          assets.slice(0, 12).map((asset) => (
            <div key={asset.id} className="flex items-center justify-between gap-4 rounded-md border bg-secondary/40 px-4 py-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant={asset.status === "published" ? "success" : asset.status === "failed" ? "danger" : "outline"}>
                    {asset.status.replace("_", " ")}
                  </Badge>
                  <span className="font-mono text-[11px] text-muted-foreground">{asset.targetKeyword ?? "No keyword"}</span>
                </div>
                <p className="truncate text-sm font-medium">{asset.title}</p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/content/${asset.id}`}>Open</Link>
              </Button>
            </div>
          ))
        ) : (
          <EmptyState
            icon={FileText}
            title="No content assets yet"
            description="Queue a keyword opportunity and LaunchBeacon will generate the article in the background."
          />
        )}
      </CardContent>
    </Card>
  );
}

function getKeywordStatus(opportunity: KeywordOpportunity, assets: ContentAsset[]): KeywordStatus {
  const asset = assets.find((item) => item.targetKeyword === opportunity.targetKeyword);
  if (!asset) {
    return "not_queued";
  }

  if (asset.status === "published") {
    return "published";
  }

  if (asset.status === "rejected" || asset.status === "failed") {
    return "rejected";
  }

  const generation = getContentGenerationState(asset.provenance);
  if (generation?.status === "queued") {
    return "queued";
  }

  if (generation?.status === "running") {
    return "drafting";
  }

  if (asset.status === "pending_review") {
    return "in_inbox";
  }

  return "queued";
}

function KeywordStatusBadge({ status }: { status: KeywordStatus }) {
  const config: Record<KeywordStatus, { label: string; variant: "outline" | "secondary" | "success" | "warning" | "danger" | "article" }> = {
    not_queued: { label: "not queued", variant: "outline" },
    queued: { label: "queued", variant: "secondary" },
    drafting: { label: "drafting", variant: "article" },
    in_inbox: { label: "in inbox", variant: "warning" },
    published: { label: "published", variant: "success" },
    rejected: { label: "rejected", variant: "danger" },
  };
  const item = config[status];
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

function DifficultyBadge({ priorityScore }: { priorityScore: number }) {
  const label = priorityScore >= 70 ? "Low" : priorityScore >= 55 ? "Med" : "High";
  const variant = priorityScore >= 70 ? "success" : priorityScore >= 55 ? "warning" : "danger";
  return <Badge variant={variant}>{label}</Badge>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

function ToggleRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className={`h-4 w-8 rounded-full ${on ? "bg-primary" : "bg-muted"}`}>
        <span className={`block size-3 translate-y-0.5 rounded-full bg-white transition ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
    </div>
  );
}

function countKeywords(opportunities: KeywordOpportunity[], assets: ContentAsset[], status: KeywordStatus) {
  return String(opportunities.filter((opportunity) => getKeywordStatus(opportunity, assets) === status).length);
}

function groupOpportunities(opportunities: KeywordOpportunity[]) {
  const map = new Map<string, KeywordOpportunity[]>();
  for (const opportunity of opportunities) {
    const cluster = opportunity.clusterName ?? "Unclustered";
    map.set(cluster, [...(map.get(cluster) ?? []), opportunity]);
  }

  return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
}

function createKeywordCsvHref(opportunities: KeywordOpportunity[]) {
  const rows = [
    ["keyword", "priority", "difficulty", "cluster", "type"],
    ...opportunities.map((opportunity) => [
      opportunity.targetKeyword,
      String(opportunity.priorityScore),
      opportunity.priorityScore >= 70 ? "Low" : opportunity.priorityScore >= 55 ? "Med" : "High",
      opportunity.clusterName ?? "Unclustered",
      opportunity.type,
    ]),
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
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
  opportunities: KeywordOpportunity[];
  assets: ContentAsset[];
  error: string | null;
  authRequired: boolean;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, opportunities: [], assets: [], error: null, authRequired: false };
    }

    const contentService = new ContentService(supabase);
    const [opportunities, assets] = await Promise.all([
      contentService.listKeywordOpportunities({ productId: product.id }),
      contentService.listContentAssets({ productId: product.id }),
    ]);

    return { product, opportunities, assets, error: null, authRequired: false };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, opportunities: [], assets: [], error: null, authRequired: true };
    }

    if (error instanceof ProductReadError || error instanceof ContentAssetReadError) {
      return { product: null, opportunities: [], assets: [], error: error.message, authRequired: false };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        opportunities: [],
        assets: [],
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
        authRequired: false,
      };
    }

    throw error;
  }
}
