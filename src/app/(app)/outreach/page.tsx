import { ExternalLink, Send } from "lucide-react";
import Link from "next/link";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requestOutreachDraftAction,
  requestProspectIdentificationAction,
  scheduleOutreachFollowUpAction,
  suppressOutreachContactAction,
} from "@/app/(app)/outreach/actions";
import type { OutreachContact } from "@/server/schemas/outreach";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import {
  OutreachContactReadError,
  OutreachService,
} from "@/server/services/outreach-service";
import {
  ProductReadError,
  ProductService,
} from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{
    prospectRequested?: string;
    prospectError?: string;
    draftRequested?: string;
    draftError?: string;
    followUpScheduled?: string;
    followUpError?: string;
    suppressed?: string;
    suppressError?: string;
  }>;
};

export default async function OutreachPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadOutreachData();
  const counts = countContacts(data.contacts);

  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar
        title="Outreach"
        eyebrow={
          data.product
            ? `Prospect pipeline / ${data.product.name}`
            : "Prospect pipeline"
        }
        actions={
          <>
            <Badge variant="secondary">{data.contacts.length} contacts</Badge>
            {data.product ? (
              <form action={requestProspectIdentificationAction}>
                <Button type="submit" size="sm">
                  Find prospects
                </Button>
              </form>
            ) : null}
          </>
        }
      />

      <section className="grid gap-4 p-6 xl:grid-cols-[1fr_340px]">
        {params.prospectRequested ? (
          <Alert className="xl:col-span-2">
            <AlertTitle>Prospect identification requested</AlertTitle>
            <AlertDescription>
              LaunchBeacon will rank outreach contacts from the current Marketing
              Brief.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.prospectError || data.error ? (
          <Alert variant="destructive" className="xl:col-span-2">
            <AlertTitle>Outreach contacts could not be loaded</AlertTitle>
            <AlertDescription>
              {data.error ??
                "Try again after confirming the product and workflow configuration."}
            </AlertDescription>
          </Alert>
        ) : null}
        {params.draftRequested ? (
          <Alert className="xl:col-span-2">
            <AlertTitle>Outreach draft requested</AlertTitle>
            <AlertDescription>
              The email draft will appear here and in the approval inbox after
              the workflow runs.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.draftError ? (
          <Alert variant="destructive" className="xl:col-span-2">
            <AlertTitle>Outreach draft request failed</AlertTitle>
            <AlertDescription>
              Only identified, drafted, or failed contacts can request draft
              generation.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.followUpScheduled ? (
          <Alert className="xl:col-span-2">
            <AlertTitle>Follow-up scheduled</AlertTitle>
            <AlertDescription>
              The contact now has a durable follow-up reminder in its
              provenance.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.followUpError ? (
          <Alert variant="destructive" className="xl:col-span-2">
            <AlertTitle>Follow-up scheduling failed</AlertTitle>
            <AlertDescription>
              Only sent or opened outreach contacts can have follow-ups
              scheduled.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.suppressed ? (
          <Alert className="xl:col-span-2">
            <AlertTitle>Contact suppressed</AlertTitle>
            <AlertDescription>
              The contact is blocked from future outreach drafts, sends, and
              follow-ups.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.suppressError ? (
          <Alert variant="destructive" className="xl:col-span-2">
            <AlertTitle>Suppression failed</AlertTitle>
            <AlertDescription>
              The contact may already be suppressed or no longer available.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-x-auto rounded-lg border bg-card">
          <div className="grid min-w-[860px] grid-cols-[minmax(0,1fr)_160px_100px_120px_220px] border-b px-4 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            <span>Contact</span>
            <span>Publication</span>
            <span>Score</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          {data.product ? (
            data.contacts.length ? (
              data.contacts.map((contact) => (
                <ContactRow key={contact.id} contact={contact} />
              ))
            ) : (
              <div className="min-w-[860px] p-4">
                <EmptyState
                  icon={Send}
                  title="No outreach prospects identified"
                  description="Find prospects after the Marketing Brief is ready. Ranked contacts will appear here before draft generation."
                  className="border-dashed"
                />
              </div>
            )
          ) : (
            <div className="min-w-[860px] p-4">
              <EmptyState
                icon={Send}
                title="No product available"
                description="Create a product during onboarding before LaunchBeacon can identify outreach prospects."
                className="border-dashed"
              />
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline state</CardTitle>
              <CardDescription>
                Contacts are ranked before draft generation begins.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Metric label="Identified" value={counts.identified} />
              <Metric label="Drafted" value={counts.drafted} />
              <Metric label="Sent" value={counts.sent} />
              <Metric label="Suppressed / failed" value={counts.closed} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How it works</CardTitle>
              <CardDescription>
                LaunchBeacon identifies newsletters, blogs, and publications whose audience matches your product. You review draft pitches before anything is sent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>1. Click <strong className="text-foreground">Find prospects</strong> to identify relevant publications.</p>
              <p>2. Click <strong className="text-foreground">Draft</strong> to generate a personalized pitch for each contact.</p>
              <p>3. Approve the email in your inbox to send it.</p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}

function ContactRow({ contact }: { contact: OutreachContact }) {
  return (
    <div className="grid min-w-[860px] grid-cols-[minmax(0,1fr)_160px_100px_120px_220px] items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-secondary/60">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Send className="size-4 text-muted-foreground" aria-hidden="true" />
          <p className="truncate text-sm font-medium">{contact.name}</p>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {followUpLabel(contact) ??
            contact.email ??
            contact.url ??
            "No contact detail yet"}
        </p>
      </div>
      <span className="truncate text-sm text-muted-foreground">
        {contact.publication ?? "Unknown"}
      </span>
      <span className="font-mono text-sm">
        {Math.round(contact.score * 100)}%
      </span>
      <Badge
        variant={
          contact.status === "failed" || contact.status === "suppressed"
            ? "danger"
            : contact.status === "sent"
              ? "success"
              : "secondary"
        }
      >
        {contact.status.replace("_", " ")}
      </Badge>
      <div className="flex justify-end gap-1.5">
        {["identified", "drafted", "failed"].includes(contact.status) ? (
          <form action={requestOutreachDraftAction}>
            <input type="hidden" name="contactId" value={contact.id} />
            <Button type="submit" variant="secondary" size="sm">
              Draft
            </Button>
          </form>
        ) : null}
        {["sent", "opened"].includes(contact.status) ? (
          <form action={scheduleOutreachFollowUpAction}>
            <input type="hidden" name="contactId" value={contact.id} />
            <input type="hidden" name="delayDays" value="5" />
            <Button type="submit" variant="secondary" size="sm">
              Follow up
            </Button>
          </form>
        ) : null}
        {!["suppressed", "converted"].includes(contact.status) ? (
          <form action={suppressOutreachContactAction}>
            <input type="hidden" name="contactId" value={contact.id} />
            <input
              type="hidden"
              name="reason"
              value="Suppressed from outreach tracker."
            />
            <Button type="submit" variant="ghost" size="sm">
              Suppress
            </Button>
          </form>
        ) : null}
        {contact.url && !contact.url.includes("example.com") ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={contact.url} target="_blank" rel="noreferrer">
              Open
              <ExternalLink data-icon="inline-end" />
            </Link>
          </Button>
        ) : null}
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

async function loadOutreachData(): Promise<{
  product: Product | null;
  contacts: OutreachContact[];
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, contacts: [], error: null };
    }

    const contacts = await new OutreachService(supabase).listContacts({
      productId: product.id,
    });
    return { product, contacts, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, contacts: [], error: error.message };
    }

    if (
      error instanceof ProductReadError ||
      error instanceof OutreachContactReadError
    ) {
      return { product: null, contacts: [], error: error.message };
    }

    if (
      error instanceof Error &&
      error.message.includes("Supabase URL and publishable key")
    ) {
      return {
        product: null,
        contacts: [],
        error:
          "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}

function countContacts(contacts: OutreachContact[]) {
  return {
    identified: String(
      contacts.filter((contact) => contact.status === "identified").length,
    ),
    drafted: String(
      contacts.filter(
        (contact) =>
          contact.status === "drafted" || contact.status === "pending_review",
      ).length,
    ),
    sent: String(
      contacts.filter(
        (contact) =>
          contact.status === "sent" ||
          contact.status === "opened" ||
          contact.status === "replied",
      ).length,
    ),
    closed: String(
      contacts.filter(
        (contact) =>
          contact.status === "suppressed" || contact.status === "failed",
      ).length,
    ),
  };
}

function followUpLabel(contact: OutreachContact) {
  const followUp = contact.provenance.followUp;
  if (!isFollowUp(followUp)) {
    return null;
  }

  return `Follow-up ${new Date(followUp.scheduledFor).toLocaleDateString()}`;
}

function isFollowUp(value: unknown): value is { scheduledFor: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "scheduledFor" in value &&
    typeof value.scheduledFor === "string"
  );
}
