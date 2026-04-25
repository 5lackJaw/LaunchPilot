import { ExternalLink, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requestCommunityThreadIngestionAction } from "@/app/(app)/community/actions";
import type { CommunityThread } from "@/server/schemas/community";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { CommunityService, CommunityThreadReadError } from "@/server/services/community-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{
    ingestionRequested?: string;
    ingestionError?: string;
  }>;
};

export default async function CommunityPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadCommunityData();
  const counts = countThreads(data.threads);

  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar
        title="Community"
        eyebrow={data.product ? `Thread intelligence / ${data.product.name}` : "Thread intelligence"}
        actions={
          <>
            <Badge variant="secondary">{data.threads.length} threads</Badge>
            {data.product ? (
              <form action={requestCommunityThreadIngestionAction}>
                <Button type="submit" size="sm">
                  Scan threads
                </Button>
              </form>
            ) : null}
          </>
        }
      />

      <section className="grid gap-4 p-6 xl:grid-cols-[1fr_340px]">
        {params.ingestionRequested ? (
          <Alert className="xl:col-span-2">
            <AlertTitle>Thread scan requested</AlertTitle>
            <AlertDescription>LaunchPilot will score relevant community threads from the current Marketing Brief.</AlertDescription>
          </Alert>
        ) : null}
        {params.ingestionError || data.error ? (
          <Alert variant="destructive" className="xl:col-span-2">
            <AlertTitle>Community threads could not be loaded</AlertTitle>
            <AlertDescription>{data.error ?? "Try again after confirming the product and workflow configuration."}</AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="grid grid-cols-[120px_minmax(0,1fr)_120px_120px_120px] border-b px-4 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            <span>Platform</span>
            <span>Thread</span>
            <span>Relevance</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          {data.product ? (
            data.threads.length ? (
              data.threads.map((thread) => <ThreadRow key={thread.id} thread={thread} />)
            ) : (
              <p className="p-4 text-sm text-muted-foreground">No community threads have been scanned yet.</p>
            )
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Create a product before scanning community threads.</p>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Thread health</CardTitle>
              <CardDescription>Observed threads are scored before any reply drafting begins.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Metric label="Observed" value={counts.observed} />
              <Metric label="Drafted" value={counts.drafted} />
              <Metric label="Review" value={counts.pendingReview} />
              <Metric label="Posted / skipped" value={counts.closed} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next step</CardTitle>
              <CardDescription>Reply drafts and authenticity guardrails will build on these scored thread records.</CardDescription>
            </CardHeader>
          </Card>
        </aside>
      </section>
    </main>
  );
}

function ThreadRow({ thread }: { thread: CommunityThread }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)_120px_120px_120px] items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-secondary/60">
      <span className="font-mono text-[11px] text-muted-foreground">{thread.platform.replace("_", " ")}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <MessageSquareText className="size-4 text-muted-foreground" aria-hidden="true" />
          <p className="truncate text-sm font-medium">{thread.threadTitle}</p>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{thread.threadAuthorHandle ?? "unknown author"}</p>
      </div>
      <span className="font-mono text-sm">{Math.round(thread.relevanceScore * 100)}%</span>
      <Badge variant={thread.status === "failed" || thread.status === "blocked" ? "danger" : thread.status === "posted" ? "success" : "secondary"}>
        {thread.status.replace("_", " ")}
      </Badge>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" asChild>
          <Link href={thread.threadUrl} target="_blank" rel="noreferrer">
            Open
            <ExternalLink data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </div>
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

async function loadCommunityData(): Promise<{
  product: Product | null;
  threads: CommunityThread[];
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, threads: [], error: null };
    }

    const threads = await new CommunityService(supabase).listThreads({ productId: product.id });
    return { product, threads, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, threads: [], error: error.message };
    }

    if (error instanceof ProductReadError || error instanceof CommunityThreadReadError) {
      return { product: null, threads: [], error: error.message };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        threads: [],
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}

function countThreads(threads: CommunityThread[]) {
  return {
    observed: String(threads.filter((thread) => thread.status === "observed").length),
    drafted: String(threads.filter((thread) => thread.status === "drafted").length),
    pendingReview: String(threads.filter((thread) => thread.status === "pending_review" || thread.status === "approved").length),
    closed: String(threads.filter((thread) => thread.status === "posted" || thread.status === "skipped").length),
  };
}
