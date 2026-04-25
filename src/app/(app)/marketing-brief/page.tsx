import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppTopbar } from "@/components/layout/app-topbar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateMarketingBriefNowAction, saveMarketingBriefAction } from "@/app/(app)/marketing-brief/actions";
import type { MarketingBrief } from "@/server/schemas/brief";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { BriefReadError, BriefService } from "@/server/services/brief-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{
    saved?: string;
    saveError?: string;
    generated?: string;
    generationError?: string;
  }>;
};

export default async function MarketingBriefPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadMarketingBriefData();

  if (data.authRequired) {
    return <BriefShell errorTitle="Sign in required" error="Sign in before viewing the Marketing Brief." />;
  }

  if (data.error) {
    return <BriefShell errorTitle="Marketing Brief could not be loaded" error={data.error} destructive />;
  }

  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar
        title="Marketing Brief"
        eyebrow={data.product ? `Product intelligence / ${data.product.name}` : "Product intelligence"}
        actions={data.brief ? <Badge variant="secondary">Version {data.brief.version}</Badge> : <Badge variant="warning">Missing brief</Badge>}
      />

      <section className="grid gap-4 p-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          {params.saved ? (
            <Alert>
              <AlertTitle>Marketing Brief saved</AlertTitle>
              <AlertDescription>A new version is now current and downstream planning will use it.</AlertDescription>
            </Alert>
          ) : null}
          {params.generated ? (
            <Alert>
              <AlertTitle>Marketing Brief generated</AlertTitle>
              <AlertDescription>The current product now has a deterministic brief for local review and keyword planning.</AlertDescription>
            </Alert>
          ) : null}
          {params.saveError ? (
            <Alert variant="destructive">
              <AlertTitle>Save failed</AlertTitle>
              <AlertDescription>{params.saveError}</AlertDescription>
            </Alert>
          ) : null}
          {params.generationError ? (
            <Alert variant="destructive">
              <AlertTitle>Generation failed</AlertTitle>
              <AlertDescription>{params.generationError}</AlertDescription>
            </Alert>
          ) : null}

          {data.product && data.brief ? <BriefEditor product={data.product} brief={data.brief} /> : null}

          {data.product && !data.brief ? (
            <Card>
              <CardHeader>
                <CardTitle>No Marketing Brief yet</CardTitle>
                <CardDescription>
                  Complete onboarding and generate the first brief before selecting SEO opportunities.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <form action={generateMarketingBriefNowAction}>
                  <input type="hidden" name="productId" value={data.product.id} />
                  <Button type="submit" size="sm">
                    Generate brief now
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </form>
                <Button asChild size="sm" variant="outline">
                  <Link href="/onboarding/interview">
                    Continue interview
                    <RefreshCw />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {!data.product ? (
            <Card>
              <CardHeader>
                <CardTitle>No product yet</CardTitle>
                <CardDescription>Create a product during onboarding before editing a Marketing Brief.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild size="sm">
                  <Link href="/onboarding/crawl">Start onboarding</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Brief state</CardTitle>
              <CardDescription>Used by SEO, content, community, directory, and outreach workflows.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Metric label="Version" value={data.brief ? String(data.brief.version) : "None"} />
              <Metric label="Keyword clusters" value={data.brief ? String(data.brief.keywordClusters.length) : "0"} />
              <Metric label="Seed topics" value={data.brief ? String(data.brief.contentCalendarSeed.length) : "0"} />
              <Metric label="Updated" value={data.brief ? formatDate(data.brief.updatedAt) : "Not generated"} />
            </CardContent>
          </Card>

          {data.brief ? (
            <Card>
              <CardHeader>
                <CardTitle>Next action</CardTitle>
                <CardDescription>The current brief can now feed keyword opportunity selection.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild size="sm" className="w-full">
                  <Link href="/seo">
                    Open SEO opportunities
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

function BriefEditor({ product, brief }: { product: Product; brief: MarketingBrief }) {
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle>{product.name}</CardTitle>
          <CardDescription>{product.url}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="max-w-4xl text-lg leading-8">{brief.tagline}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit current brief</CardTitle>
          <CardDescription>Saving creates a new version and makes it current. Existing versions remain available for audit references.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveMarketingBriefAction} className="grid gap-4 lg:grid-cols-2">
            <input type="hidden" name="productId" value={brief.productId} />
            <label className="flex flex-col gap-2 lg:col-span-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Tagline</span>
              <textarea
                name="tagline"
                defaultValue={brief.tagline}
                required
                className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>
            <TextareaList name="valueProps" label="Value props" items={brief.valueProps} />
            <TextareaList name="personas" label="Personas" items={brief.personas} />
            <TextareaList name="competitors" label="Competitors" items={brief.competitors} placeholder="One competitor per line" />
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Tone voice</span>
              <textarea
                name="toneVoice"
                defaultValue={brief.toneProfile.voice}
                required
                className="min-h-28 rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>
            <TextareaList name="toneAvoid" label="Tone avoid list" items={brief.toneProfile.avoid} />
            <div className="flex items-center justify-between gap-3 border-t pt-4 lg:col-span-2">
              <p className="font-mono text-xs text-muted-foreground">Next version: {brief.version + 1}</p>
              <Button type="submit">Save new version</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <BriefList title="Value props" items={brief.valueProps} />
        <BriefList title="Personas" items={brief.personas} />
        <KeywordClusters brief={brief} />
        <ContentSeeds brief={brief} />
      </div>
    </div>
  );
}

function TextareaList({
  name,
  label,
  items,
  placeholder,
}: {
  name: string;
  label: string;
  items: string[];
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <textarea
        name={name}
        defaultValue={items.join("\n")}
        placeholder={placeholder ?? "One item per line"}
        className="min-h-32 rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
      />
    </label>
  );
}

function BriefList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(items.length ? items : ["None recorded yet."]).map((item) => (
          <div key={item} className="rounded-md border bg-secondary px-3 py-2 text-sm">
            {item}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function KeywordClusters({ brief }: { brief: MarketingBrief }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Keyword clusters</CardTitle>
        <CardDescription>Inputs for SEO opportunity selection.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {brief.keywordClusters.map((cluster) => (
          <div key={cluster.name} className="rounded-md border bg-secondary p-3">
            <p className="text-sm font-medium">{cluster.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {cluster.keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary">{keyword}</Badge>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ContentSeeds({ brief }: { brief: MarketingBrief }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Content seeds</CardTitle>
        <CardDescription>Starting points for the content pipeline.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {brief.contentCalendarSeed.map((item) => (
          <div key={item.title} className="rounded-md border bg-secondary p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{item.title}</p>
              <Badge variant="outline">{item.format}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.rationale}</p>
          </div>
        ))}
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

function BriefShell({ errorTitle, error, destructive }: { errorTitle: string; error: string; destructive?: boolean }) {
  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar title="Marketing Brief" eyebrow="Product intelligence" />
      <div className="p-6">
        <Alert variant={destructive ? "destructive" : "default"}>
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    </main>
  );
}

async function loadMarketingBriefData(): Promise<{
  product: Product | null;
  brief: MarketingBrief | null;
  error: string | null;
  authRequired: boolean;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, brief: null, error: null, authRequired: false };
    }

    const brief = await new BriefService(supabase).getCurrentBrief({ productId: product.id });
    return { product, brief, error: null, authRequired: false };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, brief: null, error: null, authRequired: true };
    }

    if (error instanceof ProductReadError || error instanceof BriefReadError) {
      return { product: null, brief: null, error: error.message, authRequired: false };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        brief: null,
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
        authRequired: false,
      };
    }

    throw error;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}
