import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InboxItem, InboxItemEvent } from "@/server/schemas/inbox";
import { AuthRequiredError } from "@/server/services/auth-service";
import { InboxEventReadError, InboxItemReadError, InboxService } from "@/server/services/inbox-service";

type PageProps = {
  params: Promise<{
    itemId: string;
  }>;
};

export default async function InboxItemPage({ params }: PageProps) {
  const { itemId } = await params;
  const data = await loadInboxItemData(itemId);

  if (data.error) {
    return (
      <main className="min-h-screen p-6">
        <Alert variant="destructive">
          <AlertTitle>Inbox item could not be loaded</AlertTitle>
          <AlertDescription>{data.error}</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!data.item) {
    return (
      <main className="min-h-screen p-6">
        <Alert>
          <AlertTitle>Inbox item not found</AlertTitle>
          <AlertDescription>The item may have been removed or belongs to another product.</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="flex flex-col gap-4 border-b px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="mb-3">
            <Link href="/inbox">
              <ArrowLeft />
              Back to inbox
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{humanizeItemType(data.item.itemType)}</Badge>
            <Badge variant={data.item.status === "pending" ? "warning" : "outline"}>{data.item.status}</Badge>
            <Badge variant={data.item.impactEstimate === "high" ? "success" : "outline"}>{data.item.impactEstimate} impact</Badge>
          </div>
          <h1 className="mt-3 truncate font-serif text-3xl font-normal">{getTitle(data.item)}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{getPreview(data.item)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm">Skip</Button>
          <Button variant="outline" size="sm">Reject</Button>
          <Button size="sm">Approve</Button>
        </div>
      </header>

      <section className="grid gap-4 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          <ReviewBody item={data.item} />
          <RawPayload item={data.item} />
        </div>
        <aside className="flex flex-col gap-4">
          <ReviewSummary item={data.item} />
          <EventLog events={data.events} />
        </aside>
      </section>
    </main>
  );
}

function ReviewBody({ item }: { item: InboxItem }) {
  switch (item.itemType) {
    case "content_draft":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Content draft</CardTitle>
            <CardDescription>Review the draft and source rationale before approving publishing or export.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Target keyword" value={getPayloadString(item, "targetKeyword")} />
            <Field label="Suggested action" value={item.payload.suggestedAction} />
            <MarkdownBlock value={item.payload.body ?? "No draft body was included in this inbox payload."} />
          </CardContent>
        </Card>
      );
    case "community_reply":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Community reply draft</CardTitle>
            <CardDescription>Replies must stay helpful and non-promotional. Low-confidence replies remain review-gated.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Platform" value={getPayloadString(item, "platform")} />
            <Field label="Thread URL" value={getPayloadString(item, "threadUrl")} />
            <Field label="Promotional risk" value={getPayloadString(item, "promotionalRisk")} />
            <MarkdownBlock value={item.payload.body ?? "No reply draft was included in this inbox payload."} />
          </CardContent>
        </Card>
      );
    case "directory_package":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Directory package</CardTitle>
            <CardDescription>Directory submissions stay reviewable before any supported automation runs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Directory" value={getPayloadString(item, "directory")} />
            <Field label="Submission method" value={getPayloadString(item, "submissionMethod")} />
            <MarkdownBlock value={item.payload.body ?? "No listing package was included in this inbox payload."} />
          </CardContent>
        </Card>
      );
    case "outreach_email":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Outreach email</CardTitle>
            <CardDescription>Review recipient fit, hook, and follow-up context before sending.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Recipient" value={getPayloadString(item, "recipient")} />
            <Field label="Publication" value={getPayloadString(item, "publication")} />
            <Field label="Subject" value={getPayloadString(item, "subject")} />
            <MarkdownBlock value={item.payload.body ?? "No email draft was included in this inbox payload."} />
          </CardContent>
        </Card>
      );
    case "positioning_update":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Positioning update</CardTitle>
            <CardDescription>Review product-level copy before it becomes a source for downstream workflows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Suggested action" value={item.payload.suggestedAction} />
            <MarkdownBlock value={item.payload.body ?? "No positioning copy was included in this inbox payload."} />
          </CardContent>
        </Card>
      );
    case "weekly_recommendation":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Weekly recommendation</CardTitle>
            <CardDescription>Review the recommendation before it changes the upcoming execution plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Suggested action" value={item.payload.suggestedAction} />
            <MarkdownBlock value={item.payload.body ?? "No recommendation detail was included in this inbox payload."} />
          </CardContent>
        </Card>
      );
  }
}

function ReviewSummary({ item }: { item: InboxItem }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Metric label="Confidence" value={item.aiConfidence === null ? "Not scored" : `${Math.round(item.aiConfidence * 100)}%`} />
        <Metric label="Impact" value={item.impactEstimate} />
        <Metric label="Review time" value={formatReviewTime(item.reviewTimeEstimateSeconds)} />
        <Metric label="Source" value={item.sourceEntityType ?? "Generated payload"} />
        <Metric label="Created" value={new Date(item.createdAt).toLocaleString()} />
      </CardContent>
    </Card>
  );
}

function EventLog({ events }: { events: InboxItemEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit trail</CardTitle>
        <CardDescription>Server-recorded inbox events.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.length ? events.map((event) => (
          <div key={event.id} className="rounded-md border bg-secondary p-3">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="outline">{event.eventType}</Badge>
              <span className="font-mono text-[10px] text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
            </div>
            {event.reason ? <p className="mt-2 text-sm text-muted-foreground">{event.reason}</p> : null}
          </div>
        )) : (
          <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function RawPayload({ item }: { item: InboxItem }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payload</CardTitle>
        <CardDescription>Structured source data used by this review surface.</CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="max-h-80 overflow-auto rounded-md border bg-secondary p-3 font-mono text-xs text-muted-foreground">
          {JSON.stringify(item.payload, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value?.trim() || "Not provided"}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

function MarkdownBlock({ value }: { value: string }) {
  return (
    <div className="rounded-md border bg-secondary p-4">
      <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{value}</pre>
    </div>
  );
}

function getTitle(item: InboxItem) {
  return item.payload.title ?? humanizeItemType(item.itemType);
}

function getPreview(item: InboxItem) {
  return item.payload.preview ?? item.payload.suggestedAction ?? "Review the generated recommendation before taking action.";
}

function getPayloadString(item: InboxItem, key: string) {
  const value = item.payload[key];
  return typeof value === "string" ? value : undefined;
}

function humanizeItemType(itemType: InboxItem["itemType"]) {
  return itemType.replaceAll("_", " ");
}

function formatReviewTime(seconds: number | null) {
  if (seconds === null) {
    return "Not estimated";
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

async function loadInboxItemData(itemId: string): Promise<{
  item: InboxItem | null;
  events: InboxItemEvent[];
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const inbox = new InboxService(supabase);
    const item = await inbox.getItem({ inboxItemId: itemId });
    const events = await inbox.listEvents({ inboxItemId: item.id });

    return { item, events, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { item: null, events: [], error: error.message };
    }

    if (error instanceof InboxItemReadError || error instanceof InboxEventReadError) {
      return { item: null, events: [], error: error.message };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        item: null,
        events: [],
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}
