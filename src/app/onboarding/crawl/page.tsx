import type { Metadata } from "next";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CrawlJob, CrawlResult } from "@/server/schemas/crawl";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { CrawlService } from "@/server/services/crawl-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";
import { ProductCreateForm } from "@/app/onboarding/crawl/product-create-form";
import { StartCrawlForm } from "@/app/onboarding/crawl/start-crawl-form";

export const metadata: Metadata = {
  title: "Create product",
};

type PageProps = {
  searchParams: Promise<{
    productId?: string;
    created?: string;
    crawlJobId?: string;
  }>;
};

export default async function OnboardingCrawlPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const wasCreated = params.created === "1" && params.productId;
  const data = params.productId ? await loadCrawlPageData(params.productId) : null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
        <header className="flex items-center justify-between border-b pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-xs font-medium text-primary-foreground">
              LP
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Onboarding</p>
              <h1 className="font-serif text-2xl italic">Create product</h1>
            </div>
          </div>
          <Badge variant="secondary">Step 1</Badge>
        </header>

        <section className="grid flex-1 items-start gap-6 py-8 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-5">
            {wasCreated ? (
              <Alert>
                <CheckCircle2 className="absolute left-4 top-3.5 text-accent" />
                <div className="pl-7">
                  <AlertTitle>Product created</AlertTitle>
                  <AlertDescription>Start the crawl when you are ready. The job will run through the workflow queue.</AlertDescription>
                </div>
              </Alert>
            ) : null}

            {data?.error ? (
              <Alert variant="destructive">
                <AlertTitle>Onboarding state could not be loaded</AlertTitle>
                <AlertDescription>{data.error}</AlertDescription>
              </Alert>
            ) : null}

            {data?.product ? <CrawlPanel product={data.product} crawlJob={data.crawlJob} crawlResult={data.crawlResult} /> : <ProductCreatePanel />}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>What happens next</CardTitle>
              <CardDescription>LaunchPilot keeps product ownership and crawl state server-side.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p>The product is created with onboarding status.</p>
              <p>The crawl workflow will attach extracted signals to this product.</p>
              <p>Generated briefs and later assets will reference this product ID for tenant isolation.</p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function ProductCreatePanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Product details</CardTitle>
        <CardDescription>
          Add the product root URL. The next step will crawl this URL and build the first marketing brief inputs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProductCreateForm />
      </CardContent>
    </Card>
  );
}

function CrawlPanel({
  product,
  crawlJob,
  crawlResult,
}: {
  product: Product;
  crawlJob: CrawlJob | null;
  crawlResult: CrawlResult | null;
}) {
  const crawlInFlight = crawlJob?.status === "queued" || crawlJob?.status === "running";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Crawl product URL</CardTitle>
            <CardDescription>
              {product.name} - {product.url}
            </CardDescription>
          </div>
          <Badge variant={crawlJob ? "secondary" : "outline"}>{crawlJob?.status ?? "not started"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <StartCrawlForm productId={product.id} disabled={crawlInFlight} />
        {crawlJob ? <CrawlProgress crawlJob={crawlJob} /> : <p className="text-sm text-muted-foreground">No crawl job exists yet.</p>}
        {crawlResult ? <CrawlResultPanel crawlResult={crawlResult} /> : null}
      </CardContent>
    </Card>
  );
}

function CrawlResultPanel({ crawlResult }: { crawlResult: CrawlResult }) {
  const headings = Array.isArray(crawlResult.extractedSignals.headings) ? crawlResult.extractedSignals.headings : [];

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-secondary p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">Latest crawl result</h3>
          <p className="text-xs text-muted-foreground">{crawlResult.finalUrl ?? crawlResult.sourceUrl}</p>
        </div>
        <Badge variant="outline">{crawlResult.httpStatus ?? "no status"}</Badge>
      </div>
      <dl className="grid gap-3 text-sm">
        <ResultRow label="Title" value={crawlResult.pageTitle} />
        <ResultRow label="Description" value={crawlResult.metaDescription} />
        <ResultRow label="H1" value={crawlResult.h1} />
      </dl>
      {headings.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Detected headings</p>
          <div className="flex flex-wrap gap-2">
            {headings.slice(0, 6).map((heading) => (
              <Badge key={String(heading)} variant="secondary">
                {String(heading)}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid gap-1">
      <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? "Not found"}</dd>
    </div>
  );
}

function CrawlProgress({ crawlJob }: { crawlJob: CrawlJob }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${crawlJob.progressPercent}%` }} />
      </div>
      <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>{crawlJob.progressPercent}%</span>
        <span>Updated {new Date(crawlJob.updatedAt).toLocaleString()}</span>
      </div>
      <div className="flex flex-col gap-2">
        {crawlJob.steps.map((step) => (
          <div key={step.label} className="flex items-center gap-2 rounded-md border bg-secondary px-3 py-2 text-sm">
            <StepIcon status={step.status} />
            <span className="flex-1">{step.label}</span>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">{step.status}</span>
          </div>
        ))}
      </div>
      {crawlJob.errorMessage ? <p className="text-sm text-destructive">{crawlJob.errorMessage}</p> : null}
    </div>
  );
}

function StepIcon({ status }: { status: CrawlJob["steps"][number]["status"] }) {
  if (status === "completed") {
    return <CheckCircle2 className="text-accent" />;
  }

  if (status === "failed") {
    return <XCircle className="text-destructive" />;
  }

  if (status === "running") {
    return <Loader2 className="animate-spin text-primary" />;
  }

  return <Circle className="text-muted-foreground" />;
}

async function loadCrawlPageData(productId: string): Promise<{
  product: Product | null;
  crawlJob: CrawlJob | null;
  crawlResult: CrawlResult | null;
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const productService = new ProductService(supabase);
    const crawlService = new CrawlService(supabase);
    const [product, crawlJob, crawlResult] = await Promise.all([
      productService.getProduct({ productId }),
      crawlService.getLatestCrawlJob({ productId }),
      crawlService.getLatestCrawlResult({ productId }),
    ]);

    return { product, crawlJob, crawlResult, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, crawlJob: null, crawlResult: null, error: error.message };
    }

    if (error instanceof ProductReadError) {
      return { product: null, crawlJob: null, crawlResult: null, error: error.message };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        crawlJob: null,
        crawlResult: null,
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}
