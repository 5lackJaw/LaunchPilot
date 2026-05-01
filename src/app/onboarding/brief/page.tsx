import type { Metadata } from "next";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { BriefGenerationWorkflowStatus } from "@/components/product-workflow-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowStatusRefresh } from "@/components/workflow-status-refresh";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BriefGenerationJob } from "@/server/schemas/brief-generation-job";
import type { MarketingBrief } from "@/server/schemas/brief";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError, AuthService } from "@/server/services/auth-service";
import { isInternalAdmin } from "@/server/services/admin-service";
import { BriefReadError, BriefService } from "@/server/services/brief-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";
import { requestBriefGenerationAction, saveBriefEditAction } from "@/app/onboarding/brief/actions";

export const metadata: Metadata = {
  title: "Marketing Brief",
};

type PageProps = {
  searchParams: Promise<{
    productId?: string;
    requested?: string;
    requestError?: string;
    edited?: string;
    editError?: string;
  }>;
};

export default async function OnboardingBriefPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = params.productId
    ? await loadBriefData(params.productId)
    : { product: null, brief: null, briefGenerationJob: null, isAdmin: false, error: "Missing product ID." };
  const generationInFlight = data.briefGenerationJob?.status === "queued" || data.briefGenerationJob?.status === "running";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <WorkflowStatusRefresh enabled={generationInFlight} />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between border-b pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-xs font-medium text-primary-foreground">
              LP
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Product setup</p>
              <h1 className="font-serif text-2xl font-normal">Marketing Brief</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data.brief ? <Badge variant="secondary">Version {data.brief.version}</Badge> : <Badge variant="warning">Generating</Badge>}
            {data.brief ? (
              <Button asChild size="sm">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            ) : null}
          </div>
        </header>

        <section className="flex flex-1 flex-col gap-6 py-8">
          {data.error ? (
            <Alert variant="destructive">
              <AlertTitle>Brief could not be loaded</AlertTitle>
              <AlertDescription>{data.error}</AlertDescription>
            </Alert>
          ) : null}

          {params.requested ? (
            <Alert>
              <AlertTitle>Brief generation requested</AlertTitle>
              <AlertDescription>LaunchBeacon is generating the brief now. Progress updates automatically on this page.</AlertDescription>
            </Alert>
          ) : null}
          {params.requestError ? (
            <Alert variant="destructive">
              <AlertTitle>Brief generation could not start</AlertTitle>
              <AlertDescription>{params.requestError}</AlertDescription>
            </Alert>
          ) : null}
          {params.edited ? (
            <Alert>
              <AlertTitle>Brief version saved</AlertTitle>
              <AlertDescription>The product now points to the latest edited Marketing Brief version.</AlertDescription>
            </Alert>
          ) : null}
          {params.editError ? (
            <Alert variant="destructive">
              <AlertTitle>Brief edit was not saved</AlertTitle>
              <AlertDescription>{params.editError}</AlertDescription>
            </Alert>
          ) : null}

          {data.product ? (
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Product</p>
              <h2 className="text-lg font-medium">{data.product.name}</h2>
              <p className="text-sm text-muted-foreground">{data.product.url}</p>
            </div>
          ) : null}

          {data.briefGenerationJob ? <BriefGenerationWorkflowStatus job={data.briefGenerationJob} /> : null}

          {data.product && !data.brief ? (
            <Card>
              <CardHeader>
                <CardTitle>No Marketing Brief yet</CardTitle>
                <CardDescription>
                  Generate the brief from the latest crawl result and saved interview answers. This page will update while the workflow runs.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <form action={requestBriefGenerationAction} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="productId" value={data.product.id} />
                  <Button type="submit" disabled={generationInFlight}>
                    {generationInFlight ? "Generation running" : "Request generation"}
                  </Button>
                  {data.isAdmin ? (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input type="checkbox" name="adminOverride" value="1" className="size-4 rounded border" />
                      Testing mode
                    </label>
                  ) : null}
                </form>
                <Button asChild variant="outline">
                  <Link href={`/onboarding/brief?productId=${data.product.id}`}>
                    <RefreshCw />
                    Refresh
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {data.brief ? (
            <Alert>
              <AlertTitle>Product setup is ready</AlertTitle>
              <AlertDescription>
                Review or edit this brief here, then continue to the dashboard to run the rest of the product workflow.
              </AlertDescription>
            </Alert>
          ) : null}

          {data.brief ? <BriefReview brief={data.brief} /> : null}
        </section>
      </div>
    </main>
  );
}

function BriefReview({ brief }: { brief: MarketingBrief }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Positioning</CardTitle>
          <CardDescription>Generated from onboarding crawl and interview inputs.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="max-w-4xl text-lg leading-8">{brief.tagline}</p>
        </CardContent>
      </Card>

      <BriefEditForm brief={brief} />

      <BriefList title="Value props" items={brief.valueProps} />
      <BriefList title="Personas" items={brief.personas} />
      <BriefList title="Competitors" items={brief.competitors.length ? brief.competitors : ["No competitors identified yet."]} />

      <Card>
        <CardHeader>
          <CardTitle>Tone profile</CardTitle>
          <CardDescription>Used by downstream generated content and replies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Voice</p>
            <p className="mt-1 text-sm">{brief.toneProfile.voice}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Avoid</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {brief.toneProfile.avoid.map((item) => (
                <Badge key={item} variant="outline">{item}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keyword clusters</CardTitle>
          <CardDescription>Seed topics for the SEO pipeline.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

      <Card>
        <CardHeader>
          <CardTitle>Ranked channels</CardTitle>
          <CardDescription>Initial execution order for later workflows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {brief.channelsRanked.map((channel, index) => (
            <div key={channel.channel} className="grid grid-cols-[24px_1fr] gap-3 rounded-md border bg-secondary p-3">
              <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
              <div>
                <p className="text-sm font-medium">{channel.channel}</p>
                <p className="mt-1 text-sm text-muted-foreground">{channel.rationale}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Content calendar seed</CardTitle>
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

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Provenance</CardTitle>
          <CardDescription>Generation metadata for auditability.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-md border bg-secondary p-3 font-mono text-xs text-muted-foreground">
            {JSON.stringify(brief.provenance, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function BriefEditForm({ brief }: { brief: MarketingBrief }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Edit current brief</CardTitle>
        <CardDescription>Saving creates a new version and makes it current. Existing versions remain available for downstream audit references.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={saveBriefEditAction} className="grid gap-4 lg:grid-cols-2">
          <input type="hidden" name="productId" value={brief.productId} />
          <label className="flex flex-col gap-2 lg:col-span-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Tagline</span>
            <textarea
              name="tagline"
              defaultValue={brief.tagline}
              required
              className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm text-foreground"
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
              className="min-h-28 rounded-md border bg-background px-3 py-2 text-sm text-foreground"
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
        className="min-h-32 rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
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
        {items.map((item) => (
          <div key={item} className="rounded-md border bg-secondary px-3 py-2 text-sm">
            {item}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

async function loadBriefData(productId: string): Promise<{
  product: Product | null;
  brief: MarketingBrief | null;
  briefGenerationJob: BriefGenerationJob | null;
  isAdmin: boolean;
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await new AuthService(supabase).requireUser();
    const briefService = new BriefService(supabase);
    const [product, brief, briefGenerationJob] = await Promise.all([
      new ProductService(supabase).getProduct({ productId }),
      briefService.getCurrentBrief({ productId }),
      briefService.getLatestGenerationJob({ productId }),
    ]);

    return { product, brief, briefGenerationJob, isAdmin: isInternalAdmin(user), error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, brief: null, briefGenerationJob: null, isAdmin: false, error: error.message };
    }

    if (error instanceof ProductReadError || error instanceof BriefReadError) {
      return { product: null, brief: null, briefGenerationJob: null, isAdmin: false, error: error.message };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        brief: null,
        briefGenerationJob: null,
        isAdmin: false,
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}
