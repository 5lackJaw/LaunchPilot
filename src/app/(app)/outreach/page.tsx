import { ExternalLink, Send } from "lucide-react";
import Link from "next/link";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requestProspectIdentificationAction } from "@/app/(app)/outreach/actions";
import type { OutreachContact } from "@/server/schemas/outreach";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { OutreachContactReadError, OutreachService } from "@/server/services/outreach-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{
    prospectRequested?: string;
    prospectError?: string;
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
        eyebrow={data.product ? `Prospect pipeline / ${data.product.name}` : "Prospect pipeline"}
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
            <AlertDescription>LaunchPilot will rank outreach contacts from the current Marketing Brief.</AlertDescription>
          </Alert>
        ) : null}
        {params.prospectError || data.error ? (
          <Alert variant="destructive" className="xl:col-span-2">
            <AlertTitle>Outreach contacts could not be loaded</AlertTitle>
            <AlertDescription>{data.error ?? "Try again after confirming the product and workflow configuration."}</AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="grid grid-cols-[minmax(0,1fr)_160px_100px_120px_120px] border-b px-4 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            <span>Contact</span>
            <span>Publication</span>
            <span>Score</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          {data.product ? (
            data.contacts.length ? (
              data.contacts.map((contact) => <ContactRow key={contact.id} contact={contact} />)
            ) : (
              <p className="p-4 text-sm text-muted-foreground">No outreach prospects have been identified yet.</p>
            )
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Create a product before identifying outreach prospects.</p>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline state</CardTitle>
              <CardDescription>Contacts are ranked before draft generation begins.</CardDescription>
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
              <CardTitle>Next step</CardTitle>
              <CardDescription>Draft generation, send approval, follow-ups, and suppression are later Phase 7 slices.</CardDescription>
            </CardHeader>
          </Card>
        </aside>
      </section>
    </main>
  );
}

function ContactRow({ contact }: { contact: OutreachContact }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_160px_100px_120px_120px] items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-secondary/60">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Send className="size-4 text-muted-foreground" aria-hidden="true" />
          <p className="truncate text-sm font-medium">{contact.name}</p>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{contact.email ?? contact.url ?? "No contact detail yet"}</p>
      </div>
      <span className="truncate text-sm text-muted-foreground">{contact.publication ?? "Unknown"}</span>
      <span className="font-mono text-sm">{Math.round(contact.score * 100)}%</span>
      <Badge variant={contact.status === "failed" || contact.status === "suppressed" ? "danger" : contact.status === "sent" ? "success" : "secondary"}>
        {contact.status.replace("_", " ")}
      </Badge>
      <div className="flex justify-end">
        {contact.url ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={contact.url} target="_blank" rel="noreferrer">
              Open
              <ExternalLink data-icon="inline-end" />
            </Link>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" disabled>
            No URL
          </Button>
        )}
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

    const contacts = await new OutreachService(supabase).listContacts({ productId: product.id });
    return { product, contacts, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, contacts: [], error: error.message };
    }

    if (error instanceof ProductReadError || error instanceof OutreachContactReadError) {
      return { product: null, contacts: [], error: error.message };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        contacts: [],
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}

function countContacts(contacts: OutreachContact[]) {
  return {
    identified: String(contacts.filter((contact) => contact.status === "identified").length),
    drafted: String(contacts.filter((contact) => contact.status === "drafted" || contact.status === "pending_review").length),
    sent: String(contacts.filter((contact) => contact.status === "sent" || contact.status === "opened" || contact.status === "replied").length),
    closed: String(contacts.filter((contact) => contact.status === "suppressed" || contact.status === "failed").length),
  };
}
