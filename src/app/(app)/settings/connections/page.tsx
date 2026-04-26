import { CheckCircle2, Clock3, Plug, XCircle } from "lucide-react";
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
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requestConnectionSetupAction,
  revokeConnectionAction,
} from "@/app/(app)/settings/connections/actions";
import type { ExternalConnection } from "@/server/schemas/connections";
import { AuthRequiredError } from "@/server/services/auth-service";
import {
  ConnectionsReadError,
  ConnectionsService,
} from "@/server/services/connections-service";

type PageProps = {
  searchParams: Promise<{
    setupRequested?: string;
    revoked?: string;
    connectionError?: string;
  }>;
};

export default async function ConnectionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadConnectionsData();
  const connectedCount = data.connections.filter(
    (connection) => connection.status === "connected",
  ).length;

  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar
        title="Settings"
        eyebrow="Connections"
        actions={<Badge variant="secondary">{connectedCount} connected</Badge>}
      />

      <section className="grid gap-4 p-6 xl:grid-cols-[1fr_340px]">
        {params.setupRequested ? (
          <Alert className="xl:col-span-2">
            <AlertTitle>Connection setup recorded</AlertTitle>
            <AlertDescription>
              The provider is marked pending until OAuth or encrypted credential
              capture is enabled.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.revoked ? (
          <Alert className="xl:col-span-2">
            <AlertTitle>Connection revoked</AlertTitle>
            <AlertDescription>
              The stored connection record is disabled and credentials are
              cleared.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.connectionError || data.error ? (
          <Alert variant="destructive" className="xl:col-span-2">
            <AlertTitle>Connections could not be loaded</AlertTitle>
            <AlertDescription>
              {data.error ??
                "Try again after confirming Supabase configuration."}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4">
          {data.connections.map((connection) => (
            <ConnectionCard key={connection.provider} connection={connection} />
          ))}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Credential posture</CardTitle>
              <CardDescription>
                Secrets stay server-side and out of the browser.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Server environment connections are shown as connected without
                exposing raw values.
              </p>
              <p>
                Pending setup records contain provider, scopes, and status only.
              </p>
              <p>
                Live OAuth callbacks and encrypted secret capture will be added
                per provider.
              </p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}

function ConnectionCard({ connection }: { connection: ExternalConnection }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ProviderIcon connection={connection} />
              <CardTitle>{connection.label}</CardTitle>
            </div>
            <CardDescription className="mt-1">
              {connection.description}
            </CardDescription>
          </div>
          <Badge variant={badgeVariant(connection)}>
            {statusLabel(connection)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="grid gap-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{connection.category}</Badge>
            <Badge variant="outline">{sourceLabel(connection.source)}</Badge>
            {connection.scopes.map((scope) => (
              <Badge key={scope} variant="secondary">
                {scope}
              </Badge>
            ))}
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            {connection.updatedAt
              ? `Updated ${new Date(connection.updatedAt).toLocaleString()}`
              : "No stored setup record yet"}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          {connection.source === "server_env" ? (
            <Button type="button" variant="secondary" size="sm" disabled>
              Server managed
            </Button>
          ) : connection.status === "pending" ? (
            <form action={revokeConnectionAction}>
              <input
                type="hidden"
                name="provider"
                value={connection.provider}
              />
              <Button type="submit" variant="outline" size="sm">
                Cancel setup
              </Button>
            </form>
          ) : (
            <form action={requestConnectionSetupAction}>
              <input
                type="hidden"
                name="provider"
                value={connection.provider}
              />
              <Button type="submit" size="sm">
                Start setup
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderIcon({ connection }: { connection: ExternalConnection }) {
  if (connection.status === "connected") {
    return (
      <CheckCircle2 className="size-4 text-emerald-300" aria-hidden="true" />
    );
  }

  if (connection.status === "pending") {
    return <Clock3 className="size-4 text-amber-300" aria-hidden="true" />;
  }

  if (connection.status === "error") {
    return <XCircle className="size-4 text-red-300" aria-hidden="true" />;
  }

  return <Plug className="size-4 text-muted-foreground" aria-hidden="true" />;
}

function badgeVariant(connection: ExternalConnection) {
  if (connection.status === "connected") {
    return "success";
  }

  if (connection.status === "pending") {
    return "warning";
  }

  if (connection.status === "error") {
    return "danger";
  }

  return "secondary";
}

function statusLabel(connection: ExternalConnection) {
  if (connection.source === "server_env") {
    return "server env";
  }

  return connection.status;
}

function sourceLabel(source: ExternalConnection["source"]) {
  const labels: Record<ExternalConnection["source"], string> = {
    database: "stored record",
    server_env: "server configured",
    not_configured: "not configured",
  };

  return labels[source];
}

async function loadConnectionsData(): Promise<{
  connections: ExternalConnection[];
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const connections = await new ConnectionsService(
      supabase,
    ).listConnections();
    return { connections, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { connections: [], error: error.message };
    }

    if (error instanceof ConnectionsReadError) {
      return { connections: [], error: error.message };
    }

    if (
      error instanceof Error &&
      error.message.includes("Supabase URL and publishable key")
    ) {
      return {
        connections: [],
        error:
          "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}
