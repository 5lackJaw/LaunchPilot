import { ExternalLink, FolderKanban } from "lucide-react";
import Link from "next/link";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  autoSubmitDirectorySubmissionAction,
  requestDirectoryPackagesAction,
  updateDirectorySubmissionStatusAction,
} from "@/app/(app)/directories/actions";
import type { DirectoryTrackerItem } from "@/server/schemas/directory";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { DirectoryReadError, DirectoryService } from "@/server/services/directory-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{
    packageRequested?: string;
    packageError?: string;
    statusUpdated?: string;
    statusError?: string;
    autoSubmitted?: string;
    autoSubmitError?: string;
  }>;
};

export default async function DirectoriesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadDirectoryData();

  if (data.error) {
    return (
      <main className="flex min-h-screen flex-col">
        <AppTopbar title="Directories" eyebrow="Submission tracker" />
        <div className="p-6">
          <Alert variant="destructive">
            <AlertTitle>Directory tracker could not be loaded</AlertTitle>
            <AlertDescription>{data.error}</AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

  const counts = countStatuses(data.items);

  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar
        title="Directories"
        eyebrow={data.product ? `Submission tracker / ${data.product.name}` : "Submission tracker"}
        actions={
          <>
            <Badge variant="secondary">{data.items.length} directories</Badge>
            {data.product ? (
              <form action={requestDirectoryPackagesAction}>
                <Button type="submit" size="sm">
                  Generate packages
                </Button>
              </form>
            ) : null}
          </>
        }
      />

      <section className="grid gap-4 p-6 xl:grid-cols-[1fr_340px]">
        {params.packageRequested ? (
          <Alert className="xl:col-span-2">
            <AlertTitle>Listing package generation requested</AlertTitle>
            <AlertDescription>Directory packages will appear here and in the approval inbox after the workflow runs.</AlertDescription>
          </Alert>
        ) : null}
        {params.packageError ? (
          <Alert variant="destructive" className="xl:col-span-2">
            <AlertTitle>Listing package generation failed</AlertTitle>
            <AlertDescription>Try again after confirming the product and workflow configuration.</AlertDescription>
          </Alert>
        ) : null}
        {params.statusUpdated ? (
          <Alert className="xl:col-span-2">
            <AlertTitle>Directory status updated</AlertTitle>
            <AlertDescription>The tracker now reflects the manual submission state.</AlertDescription>
          </Alert>
        ) : null}
        {params.statusError ? (
          <Alert variant="destructive" className="xl:col-span-2">
            <AlertTitle>Directory status update failed</AlertTitle>
            <AlertDescription>Reload the page and try again.</AlertDescription>
          </Alert>
        ) : null}
        {params.autoSubmitted ? (
          <Alert className="xl:col-span-2">
            <AlertTitle>Directory auto-submitted</AlertTitle>
            <AlertDescription>The supported directory submission was recorded as submitted with server-side provenance.</AlertDescription>
          </Alert>
        ) : null}
        {params.autoSubmitError ? (
          <Alert variant="destructive" className="xl:col-span-2">
            <AlertTitle>Directory auto-submit failed</AlertTitle>
            <AlertDescription>Only pending submissions for auto-supported directories with generated packages can be submitted automatically.</AlertDescription>
          </Alert>
        ) : null}
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="grid grid-cols-[minmax(0,1.4fr)_120px_120px_120px_180px] border-b px-4 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            <span>Directory</span>
            <span>Method</span>
            <span>Status</span>
            <span>Review</span>
            <span className="text-right">Action</span>
          </div>
          {data.product ? (
            data.items.length ? (
              data.items.map((item) => <DirectoryRow key={item.directory.id} item={item} />)
            ) : (
              <p className="p-4 text-sm text-muted-foreground">No active directories are configured.</p>
            )
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Create a product before tracking directory submissions.</p>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Submission state</CardTitle>
              <CardDescription>Current product progress across the directory catalog.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Metric label="Pending" value={counts.pending} />
              <Metric label="Submitted" value={counts.submitted} />
              <Metric label="Live" value={counts.live} />
              <Metric label="Skipped / failed" value={counts.skippedFailed} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next step</CardTitle>
              <CardDescription>Manual and assisted directories stay review-gated. Auto-submit only appears for supported catalog entries.</CardDescription>
            </CardHeader>
          </Card>
        </aside>
      </section>
    </main>
  );
}

function DirectoryRow({ item }: { item: DirectoryTrackerItem }) {
  const status = item.submission?.status ?? "pending";

  return (
    <div className="grid grid-cols-[minmax(0,1.4fr)_120px_120px_120px_180px] items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-secondary/60">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <FolderKanban className="size-4 text-muted-foreground" aria-hidden="true" />
          <p className="truncate text-sm font-medium">{item.directory.name}</p>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {item.directory.categories.slice(0, 3).map((category) => (
            <Badge key={category} variant="outline">
              {category}
            </Badge>
          ))}
        </div>
      </div>
      <span className="font-mono text-[11px] text-muted-foreground">{item.directory.submissionMethod.replace("_", " ")}</span>
      <Badge variant={status === "live" ? "success" : status === "failed" || status === "rejected" ? "danger" : status === "submitted" ? "warning" : "secondary"}>
        {status}
      </Badge>
      <span className="font-mono text-[11px] text-muted-foreground">
        {item.directory.reviewTimeDays === null ? "unknown" : `${item.directory.reviewTimeDays}d`}
      </span>
      <DirectoryActions item={item} />
    </div>
  );
}

function DirectoryActions({ item }: { item: DirectoryTrackerItem }) {
  if (!item.submission) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link href={item.directory.url} target="_blank" rel="noreferrer">
          DA {item.directory.avgDa ?? "n/a"}
          <ExternalLink data-icon="inline-end" />
        </Link>
      </Button>
    );
  }

  const status = item.submission.status;
  const canAutoSubmit =
    status === "pending" &&
    item.directory.submissionMethod === "auto_supported" &&
    Object.keys(item.submission.listingPayload).length > 0;

  if (canAutoSubmit) {
    return (
      <div className="flex justify-end gap-1.5">
        <form action={autoSubmitDirectorySubmissionAction}>
          <input type="hidden" name="submissionId" value={item.submission.id} />
          <Button type="submit" variant="secondary" size="sm">
            Auto-submit
          </Button>
        </form>
        <form action={updateDirectorySubmissionStatusAction}>
          <input type="hidden" name="submissionId" value={item.submission.id} />
          <input type="hidden" name="status" value="skipped" />
          <Button type="submit" variant="ghost" size="sm">
            Skip
          </Button>
        </form>
      </div>
    );
  }

  const nextStatuses =
    status === "submitted"
      ? [
          { status: "live", label: "Mark live" },
          { status: "rejected", label: "Rejected" },
        ]
      : status === "live"
        ? []
        : status === "pending"
          ? [
              { status: "submitted", label: "Submitted" },
              { status: "skipped", label: "Skip" },
            ]
          : [{ status: "pending", label: "Retry" }];

  if (!nextStatuses.length) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link href={item.directory.url} target="_blank" rel="noreferrer">
          View
          <ExternalLink data-icon="inline-end" />
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex justify-end gap-1.5">
      {nextStatuses.map((next) => (
        <form key={next.status} action={updateDirectorySubmissionStatusAction}>
          <input type="hidden" name="submissionId" value={item.submission?.id} />
          <input type="hidden" name="status" value={next.status} />
          <Button type="submit" variant={next.status === "submitted" || next.status === "live" ? "secondary" : "ghost"} size="sm">
            {next.label}
          </Button>
        </form>
      ))}
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

async function loadDirectoryData(): Promise<{
  product: Product | null;
  items: DirectoryTrackerItem[];
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, items: [], error: null };
    }

    const items = await new DirectoryService(supabase).listTracker({ productId: product.id });
    return { product, items, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, items: [], error: error.message };
    }

    if (error instanceof ProductReadError || error instanceof DirectoryReadError) {
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

function countStatuses(items: DirectoryTrackerItem[]) {
  return {
    pending: String(items.filter((item) => !item.submission || item.submission.status === "pending").length),
    submitted: String(items.filter((item) => item.submission?.status === "submitted").length),
    live: String(items.filter((item) => item.submission?.status === "live").length),
    skippedFailed: String(items.filter((item) => item.submission && ["skipped", "failed", "rejected"].includes(item.submission.status)).length),
  };
}
