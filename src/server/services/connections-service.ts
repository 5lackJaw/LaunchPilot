import type { SupabaseClient } from "@supabase/supabase-js";
import {
  connectionProviderInputSchema,
  externalConnectionSchema,
} from "@/server/schemas/connections";
import type {
  ConnectionProvider,
  ExternalConnection,
} from "@/server/schemas/connections";
import { AuthService } from "@/server/services/auth-service";

const connectionSelect =
  "id,user_id,provider,scopes,status,last_validated_at,created_at,updated_at";

const providerCatalog: Array<{
  provider: ConnectionProvider;
  label: string;
  category: ExternalConnection["category"];
  description: string;
  defaultScopes: string[];
  envConfigured: () => boolean;
}> = [
  {
    provider: "ghost",
    label: "Ghost",
    category: "Publishing",
    description: "Create reviewed content drafts in Ghost.",
    defaultScopes: ["content:write"],
    envConfigured: () =>
      Boolean(
        process.env.GHOST_ADMIN_API_URL && process.env.GHOST_ADMIN_API_KEY,
      ),
  },
  {
    provider: "wordpress",
    label: "WordPress",
    category: "Publishing",
    description: "Create reviewed content drafts in WordPress.",
    defaultScopes: ["posts:write"],
    envConfigured: () =>
      Boolean(
        process.env.WORDPRESS_API_URL &&
        process.env.WORDPRESS_USERNAME &&
        process.env.WORDPRESS_APPLICATION_PASSWORD,
      ),
  },
  {
    provider: "webflow",
    label: "Webflow",
    category: "Publishing",
    description: "Create staged CMS items for reviewed content.",
    defaultScopes: ["cms:write"],
    envConfigured: () =>
      Boolean(
        process.env.WEBFLOW_API_TOKEN && process.env.WEBFLOW_COLLECTION_ID,
      ),
  },
  {
    provider: "reddit",
    label: "Reddit",
    category: "Community",
    description: "Monitor conversations and post approved replies.",
    defaultScopes: ["read", "submit"],
    envConfigured: () => false,
  },
  {
    provider: "hacker_news",
    label: "Hacker News",
    category: "Community",
    description: "Track relevant threads and manage approved reply workflows.",
    defaultScopes: ["threads:read"],
    envConfigured: () => false,
  },
  {
    provider: "google_search_console",
    label: "Google Search Console",
    category: "Analytics",
    description: "Import keyword movement and search performance signals.",
    defaultScopes: ["searchanalytics.readonly"],
    envConfigured: () => false,
  },
  {
    provider: "plausible",
    label: "Plausible",
    category: "Analytics",
    description: "Import traffic source and conversion snapshots.",
    defaultScopes: ["stats:read"],
    envConfigured: () => false,
  },
  {
    provider: "resend",
    label: "Resend",
    category: "Email",
    description: "Send weekly digest email and transactional notices.",
    defaultScopes: ["email:send"],
    envConfigured: () =>
      Boolean(
        process.env.RESEND_API_KEY && process.env.WEEKLY_DIGEST_FROM_EMAIL,
      ),
  },
  {
    provider: "outreach_email",
    label: "Outreach Email",
    category: "Email",
    description: "Send approved outreach emails and follow-up reminders.",
    defaultScopes: ["email:send"],
    envConfigured: () => false,
  },
];

export class ConnectionsService {
  constructor(private readonly supabase: SupabaseClient) {}

  async listConnections(): Promise<ExternalConnection[]> {
    const user = await new AuthService(this.supabase).requireUser();
    const { data, error } = await this.supabase
      .from("external_connections")
      .select(connectionSelect)
      .eq("user_id", user.id)
      .order("provider", { ascending: true });

    if (error) {
      throw new ConnectionsReadError(error.message);
    }

    const byProvider = new Map(
      (data ?? []).map((row) => [row.provider as ConnectionProvider, row]),
    );
    return providerCatalog.map((provider) => {
      const row = byProvider.get(provider.provider);
      const envConfigured = provider.envConfigured();

      return externalConnectionSchema.parse({
        id: row?.id ?? null,
        userId: row?.user_id ?? user.id,
        provider: provider.provider,
        label: provider.label,
        category: provider.category,
        description: provider.description,
        scopes: row?.scopes ?? provider.defaultScopes,
        status: envConfigured ? "connected" : (row?.status ?? "revoked"),
        source: envConfigured
          ? "server_env"
          : row
            ? "database"
            : "not_configured",
        lastValidatedAt: row?.last_validated_at ?? null,
        createdAt: row?.created_at ?? null,
        updatedAt: row?.updated_at ?? null,
      });
    });
  }

  async requestSetup(input: unknown): Promise<ExternalConnection> {
    const parsed = connectionProviderInputSchema.parse(input);
    const user = await new AuthService(this.supabase).requireUser();
    const provider = providerCatalog.find(
      (item) => item.provider === parsed.provider,
    );

    if (!provider) {
      throw new ConnectionsUpdateError("Provider is not supported.");
    }

    const { data, error } = await this.supabase
      .from("external_connections")
      .upsert(
        {
          user_id: user.id,
          provider: parsed.provider,
          credentials_encrypted: null,
          scopes: provider.defaultScopes,
          status: "pending",
          metadata: {
            setupRequestedAt: new Date().toISOString(),
            setupMode: "manual_pending",
          },
        },
        { onConflict: "user_id,provider" },
      )
      .select(connectionSelect)
      .single();

    if (error) {
      throw new ConnectionsUpdateError(error.message);
    }

    return mapDatabaseConnection(data, provider);
  }

  async revokeConnection(input: unknown): Promise<ExternalConnection> {
    const parsed = connectionProviderInputSchema.parse(input);
    const user = await new AuthService(this.supabase).requireUser();
    const provider = providerCatalog.find(
      (item) => item.provider === parsed.provider,
    );

    if (!provider) {
      throw new ConnectionsUpdateError("Provider is not supported.");
    }

    const { data, error } = await this.supabase
      .from("external_connections")
      .upsert(
        {
          user_id: user.id,
          provider: parsed.provider,
          credentials_encrypted: null,
          scopes: provider.defaultScopes,
          status: "revoked",
          metadata: {
            revokedAt: new Date().toISOString(),
          },
        },
        { onConflict: "user_id,provider" },
      )
      .select(connectionSelect)
      .single();

    if (error) {
      throw new ConnectionsUpdateError(error.message);
    }

    return mapDatabaseConnection(data, provider);
  }
}

export class ConnectionsReadError extends Error {
  constructor(message: string) {
    super(`Connections could not be loaded: ${message}`);
    this.name = "ConnectionsReadError";
  }
}

export class ConnectionsUpdateError extends Error {
  constructor(message: string) {
    super(`Connection could not be updated: ${message}`);
    this.name = "ConnectionsUpdateError";
  }
}

function mapDatabaseConnection(
  data: {
    id: string;
    user_id: string;
    provider: string;
    scopes: string[];
    status: string;
    last_validated_at: string | null;
    created_at: string;
    updated_at: string;
  },
  provider: (typeof providerCatalog)[number],
) {
  return externalConnectionSchema.parse({
    id: data.id,
    userId: data.user_id,
    provider: data.provider,
    label: provider.label,
    category: provider.category,
    description: provider.description,
    scopes: data.scopes,
    status: data.status,
    source: "database",
    lastValidatedAt: data.last_validated_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}
