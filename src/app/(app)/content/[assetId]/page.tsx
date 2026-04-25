import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppTopbar } from "@/components/layout/app-topbar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  publishContentAssetToGhostAction,
  publishContentAssetToWebflowAction,
  publishContentAssetToWordPressAction,
  requestArticleGenerationAction,
  updateContentAssetAction,
} from "@/app/(app)/content/[assetId]/actions";
import { isGhostPublishingConfigured } from "@/server/publishing/ghost-adapter";
import { isWebflowPublishingConfigured } from "@/server/publishing/webflow-adapter";
import { isWordPressPublishingConfigured } from "@/server/publishing/wordpress-adapter";
import type { ContentAsset } from "@/server/schemas/content";
import { AuthRequiredError } from "@/server/services/auth-service";
import { ContentAssetReadError, ContentService } from "@/server/services/content-service";

type PageProps = {
  params: Promise<{ assetId: string }>;
  searchParams: Promise<{
    selected?: string;
    saved?: string;
    saveError?: string;
    generationRequested?: string;
    generationError?: string;
    ghostPublished?: string;
    ghostError?: string;
    wordpressPublished?: string;
    wordpressError?: string;
    webflowPublished?: string;
    webflowError?: string;
  }>;
};

export default async function ContentAssetPage({ params, searchParams }: PageProps) {
  const [{ assetId }, query] = await Promise.all([params, searchParams]);
  const data = await loadContentAsset(assetId);

  if (data.authRequired) {
    return <ContentAssetShell title="Content asset" errorTitle="Sign in required" error="Sign in before editing content assets." />;
  }

  if (data.error || !data.asset) {
    return <ContentAssetShell title="Content asset" errorTitle="Content asset could not be loaded" error={data.error ?? "Content asset was not found."} destructive />;
  }

  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar
        title="Content Editor"
        eyebrow={`${data.asset.type} / ${data.asset.status}`}
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link href="/content">
              <ArrowLeft />
              Library
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 p-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          {query.selected ? (
            <Alert>
              <AlertTitle>Content draft queued</AlertTitle>
              <AlertDescription>This content asset is now ready for draft generation or manual editing.</AlertDescription>
            </Alert>
          ) : null}
          {query.saved ? (
            <Alert>
              <AlertTitle>Content saved</AlertTitle>
              <AlertDescription>The draft fields were updated.</AlertDescription>
            </Alert>
          ) : null}
          {query.generationRequested ? (
            <Alert>
              <AlertTitle>Generation requested</AlertTitle>
              <AlertDescription>The content workflow will generate a draft and create an inbox review item.</AlertDescription>
            </Alert>
          ) : null}
          {query.ghostPublished ? (
            <Alert>
              <AlertTitle>Ghost draft created</AlertTitle>
              <AlertDescription>The content asset was sent to Ghost as a draft.</AlertDescription>
            </Alert>
          ) : null}
          {query.wordpressPublished ? (
            <Alert>
              <AlertTitle>WordPress draft created</AlertTitle>
              <AlertDescription>The content asset was sent to WordPress as a draft.</AlertDescription>
            </Alert>
          ) : null}
          {query.webflowPublished ? (
            <Alert>
              <AlertTitle>Webflow draft created</AlertTitle>
              <AlertDescription>The content asset was sent to Webflow as a staged CMS item.</AlertDescription>
            </Alert>
          ) : null}
          {query.saveError ? (
            <Alert variant="destructive">
              <AlertTitle>Save failed</AlertTitle>
              <AlertDescription>{query.saveError}</AlertDescription>
            </Alert>
          ) : null}
          {query.generationError ? (
            <Alert variant="destructive">
              <AlertTitle>Generation request failed</AlertTitle>
              <AlertDescription>{query.generationError}</AlertDescription>
            </Alert>
          ) : null}
          {query.ghostError ? (
            <Alert variant="destructive">
              <AlertTitle>Ghost publish failed</AlertTitle>
              <AlertDescription>{query.ghostError}</AlertDescription>
            </Alert>
          ) : null}
          {query.wordpressError ? (
            <Alert variant="destructive">
              <AlertTitle>WordPress publish failed</AlertTitle>
              <AlertDescription>{query.wordpressError}</AlertDescription>
            </Alert>
          ) : null}
          {query.webflowError ? (
            <Alert variant="destructive">
              <AlertTitle>Webflow publish failed</AlertTitle>
              <AlertDescription>{query.webflowError}</AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{data.asset.title}</CardTitle>
              <CardDescription>{data.asset.targetKeyword ?? "No target keyword"}</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateContentAssetAction} className="flex flex-col gap-4">
                <input type="hidden" name="assetId" value={data.asset.id} />
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" defaultValue={data.asset.title} required maxLength={240} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="metaTitle">Meta title</Label>
                  <Input id="metaTitle" name="metaTitle" defaultValue={data.asset.metaTitle ?? ""} maxLength={120} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="metaDescription">Meta description</Label>
                  <Input id="metaDescription" name="metaDescription" defaultValue={data.asset.metaDescription ?? ""} maxLength={300} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bodyMd">Body markdown</Label>
                  <textarea
                    id="bodyMd"
                    name="bodyMd"
                    defaultValue={data.asset.bodyMd}
                    className="min-h-[420px] rounded-md border bg-background px-3 py-2 font-mono text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Article draft markdown will appear here after generation. You can also edit it manually."
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" asChild>
                    <Link href="/content">Cancel</Link>
                  </Button>
                  <Button type="submit">Save draft</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Asset state</CardTitle>
              <CardDescription>Server-owned status and provenance for this draft.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Status" value={<Badge variant="outline">{data.asset.status}</Badge>} />
              <Row label="Type" value={data.asset.type} />
              <Row label="Brief" value={`v${data.asset.briefVersion}`} />
              <Row label="Confidence" value={data.asset.aiConfidence === null ? "Not scored" : `${Math.round(data.asset.aiConfidence * 100)}%`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Draft generation</CardTitle>
              <CardDescription>Generate body copy and send the draft to the approval inbox.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={requestArticleGenerationAction}>
                <input type="hidden" name="assetId" value={data.asset.id} />
                <Button
                  type="submit"
                  size="sm"
                  className="w-full"
                  disabled={!["draft", "pending_review", "rejected", "failed"].includes(data.asset.status)}
                >
                  Generate draft
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
              <CardDescription>Export Markdown now. CMS adapters come later.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data.asset.bodyMd.trim() ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={`/content/${data.asset.id}/export`}>
                    <Download />
                    Export Markdown
                  </a>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  <Download />
                  Export Markdown
                </Button>
              )}
              {!data.asset.bodyMd.trim() ? (
                <p className="text-xs text-muted-foreground">Generate or write body markdown before export.</p>
              ) : null}
              <form action={publishContentAssetToGhostAction}>
                <input type="hidden" name="assetId" value={data.asset.id} />
                <Button
                  type="submit"
                  size="sm"
                  className="w-full"
                  disabled={!isGhostPublishingConfigured() || !data.asset.bodyMd.trim() || !["approved", "pending_review"].includes(data.asset.status)}
                >
                  Send draft to Ghost
                </Button>
              </form>
              {!isGhostPublishingConfigured() ? (
                <p className="text-xs text-muted-foreground">Set GHOST_ADMIN_URL and GHOST_ADMIN_API_KEY to enable Ghost publishing.</p>
              ) : null}
              <form action={publishContentAssetToWordPressAction}>
                <input type="hidden" name="assetId" value={data.asset.id} />
                <Button
                  type="submit"
                  size="sm"
                  className="w-full"
                  disabled={!isWordPressPublishingConfigured() || !data.asset.bodyMd.trim() || !["approved", "pending_review"].includes(data.asset.status)}
                >
                  Send draft to WordPress
                </Button>
              </form>
              {!isWordPressPublishingConfigured() ? (
                <p className="text-xs text-muted-foreground">Set WORDPRESS_SITE_URL, WORDPRESS_USERNAME, and WORDPRESS_APPLICATION_PASSWORD to enable WordPress publishing.</p>
              ) : null}
              <form action={publishContentAssetToWebflowAction}>
                <input type="hidden" name="assetId" value={data.asset.id} />
                <Button
                  type="submit"
                  size="sm"
                  className="w-full"
                  disabled={!isWebflowPublishingConfigured() || !data.asset.bodyMd.trim() || !["approved", "pending_review"].includes(data.asset.status)}
                >
                  Send draft to Webflow
                </Button>
              </form>
              {!isWebflowPublishingConfigured() ? (
                <p className="text-xs text-muted-foreground">Set WEBFLOW_API_TOKEN and WEBFLOW_COLLECTION_ID to enable Webflow publishing.</p>
              ) : null}
            </CardContent>
            {data.asset.publishedUrl ? (
              <CardContent className="pt-0">
                <Button size="sm" variant="outline" asChild>
                  <a href={data.asset.publishedUrl} target="_blank" rel="noreferrer">
                    Open published URL
                    <ExternalLink data-icon="inline-end" />
                  </a>
                </Button>
              </CardContent>
            ) : null}
          </Card>
        </aside>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-mono text-xs">{value}</span>
    </div>
  );
}

function ContentAssetShell({
  title,
  errorTitle,
  error,
  destructive,
}: {
  title: string;
  errorTitle: string;
  error: string;
  destructive?: boolean;
}) {
  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar title={title} eyebrow="Generated assets" />
      <div className="p-6">
        <Alert variant={destructive ? "destructive" : "default"}>
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    </main>
  );
}

async function loadContentAsset(assetId: string): Promise<{
  asset: ContentAsset | null;
  error: string | null;
  authRequired: boolean;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const asset = await new ContentService(supabase).getContentAsset({ assetId });
    return { asset, error: null, authRequired: false };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { asset: null, error: null, authRequired: true };
    }

    if (error instanceof ContentAssetReadError) {
      return { asset: null, error: error.message, authRequired: false };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        asset: null,
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
        authRequired: false,
      };
    }

    throw error;
  }
}
