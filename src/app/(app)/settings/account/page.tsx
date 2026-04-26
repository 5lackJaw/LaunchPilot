import { Download, ShieldAlert, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteAccountAction } from "@/app/(app)/settings/account/actions";
import { AccountService, accountErrorMessage, type AccountOverview } from "@/server/services/account-service";

type PageProps = {
  searchParams: Promise<{
    deleteError?: string;
  }>;
};

export default async function AccountSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadAccountData();

  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar
        title="Settings"
        eyebrow="Account"
        actions={data.overview ? <Badge variant="secondary">{data.overview.user.planTier} plan</Badge> : null}
      />

      <section className="grid gap-4 p-6 xl:grid-cols-[1fr_340px]">
        {params.deleteError || data.error ? (
          <Alert variant="destructive" className="xl:col-span-2">
            <AlertTitle>Account settings could not be completed</AlertTitle>
            <AlertDescription>{data.error ?? params.deleteError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4">
          {data.overview ? (
            <>
              <AccountOverviewCard overview={data.overview} />
              <ExportCard />
              <DeleteCard />
            </>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Data scope</CardTitle>
              <CardDescription>
                Export and deletion actions are server-authoritative and bound to the signed-in account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Exports include product, workflow, approval, analytics, and settings records.</p>
              <p>Connection credentials are never included; the export only reports whether credentials are configured.</p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}

function AccountOverviewCard({ overview }: { overview: AccountOverview }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account data</CardTitle>
        <CardDescription>{overview.user.email ?? "Signed-in LaunchPilot account"}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
        <Metric label="Products" value={String(overview.productCount)} />
        <Metric label="Connections" value={String(overview.connectionCount)} />
        <Metric label="Stripe customer" value={overview.user.stripeCustomerConfigured ? "linked" : "not linked"} />
      </CardContent>
    </Card>
  );
}

function ExportCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Download className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <CardTitle>Export data</CardTitle>
            <CardDescription>
              Download a JSON snapshot of account-owned LaunchPilot records.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button size="sm" asChild>
          <a href="/settings/account/export">Download JSON export</a>
        </Button>
      </CardContent>
    </Card>
  );
}

function DeleteCard() {
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-4 text-destructive" aria-hidden="true" />
          <div>
            <CardTitle>Delete account</CardTitle>
            <CardDescription>
              Permanently deletes the Supabase auth user and cascades account-owned LaunchPilot data.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form action={deleteAccountAction} className="grid gap-3 sm:max-w-md">
          <div className="grid gap-1.5">
            <Label htmlFor="confirmation">Type DELETE to confirm</Label>
            <Input id="confirmation" name="confirmation" autoComplete="off" />
          </div>
          <Button type="submit" size="sm" variant="destructive">
            <Trash2 />
            Delete account
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-secondary/40 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}

async function loadAccountData(): Promise<{
  overview: AccountOverview | null;
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const overview = await new AccountService(supabase).getOverview();
    return { overview, error: null };
  } catch (error) {
    const message = accountErrorMessage(error);
    if (message) {
      return { overview: null, error: message };
    }

    throw error;
  }
}
