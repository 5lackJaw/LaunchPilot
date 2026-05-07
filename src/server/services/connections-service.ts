import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import {
  connectionProviderInputSchema,
  externalConnectionSchema,
  saveConnectionCredentialsSchema,
} from "@/server/schemas/connections";
import type {
  ConnectionProvider,
  ExternalConnection,
  SaveConnectionCredentialsInput,
} from "@/server/schemas/connections";
import {
  isGhostLegacyEnvConfigured,
  isWebflowLegacyEnvConfigured,
  isWordPressLegacyEnvConfigured,
} from "@/server/publishing/legacy-env-fallback";
import {
  decryptConnectionCredentials,
  encryptConnectionCredentials,
} from "@/server/security/encrypted-credentials";
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
    envConfigured: isGhostLegacyEnvConfigured,
  },
  {
    provider: "wordpress",
    label: "WordPress",
    category: "Publishing",
    description: "Create reviewed content drafts in WordPress.",
    defaultScopes: ["posts:write"],
    envConfigured: isWordPressLegacyEnvConfigured,
  },
  {
    provider: "webflow",
    label: "Webflow",
    category: "Publishing",
    description: "Create staged CMS items for reviewed content.",
    defaultScopes: ["cms:write"],
    envConfigured: isWebflowLegacyEnvConfigured,
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
    envConfigured: () => Boolean(env.PLAUSIBLE_SITE_ID && env.PLAUSIBLE_API_KEY),
  },
  {
    provider: "resend",
    label: "Resend",
    category: "Email",
    description: "Send weekly digest email and transactional notices.",
    defaultScopes: ["email:send"],
    envConfigured: () => Boolean(env.RESEND_API_KEY && env.WEEKLY_DIGEST_FROM_EMAIL),
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

  async saveCredentials(input: unknown): Promise<ExternalConnection> {
    const parsed = saveConnectionCredentialsSchema.parse(input);
    const user = await new AuthService(this.supabase).requireUser();
    const provider = providerCatalog.find(
      (item) => item.provider === parsed.provider,
    );

    if (!provider) {
      throw new ConnectionsUpdateError("Provider is not supported.");
    }

    await validateProviderCredentials(parsed);

    const credentials = serializeProviderCredentials(parsed);
    const { data, error } = await this.supabase
      .from("external_connections")
      .upsert(
        {
          user_id: user.id,
          provider: parsed.provider,
          credentials_encrypted: encryptConnectionCredentials(credentials),
          scopes: provider.defaultScopes,
          status: "connected",
          last_validated_at: new Date().toISOString(),
          metadata: {
            configuredAt: new Date().toISOString(),
            configuredFields: Object.keys(credentials),
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

  async getConnectedCredentials(provider: ConnectionProvider) {
    const user = await new AuthService(this.supabase).requireUser();
    const { data, error } = await this.supabase
      .from("external_connections")
      .select("credentials_encrypted")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .eq("status", "connected")
      .maybeSingle();

    if (error) {
      throw new ConnectionsReadError(error.message);
    }

    if (!data?.credentials_encrypted) {
      return null;
    }

    return decryptConnectionCredentials(data.credentials_encrypted);
  }
}

async function validateProviderCredentials(input: SaveConnectionCredentialsInput) {
  if (input.provider === "ghost") {
    const response = await fetch(new URL("/ghost/api/admin/site/", normalizeUrl(input.adminUrl)), {
      headers: {
        authorization: `Ghost ${createGhostAdminToken(input.adminApiKey)}`,
        "accept-version": input.apiVersion,
      },
    });

    if (!response.ok) {
      throw new ConnectionsUpdateError(`Ghost rejected the credentials with HTTP ${response.status}.`);
    }
  }

  if (input.provider === "wordpress") {
    const response = await fetch(new URL("/wp-json/wp/v2/users/me", normalizeUrl(input.siteUrl)), {
      headers: {
        authorization: `Basic ${Buffer.from(`${input.username}:${input.applicationPassword}`).toString("base64")}`,
      },
    });

    if (!response.ok) {
      throw new ConnectionsUpdateError(`WordPress rejected the credentials with HTTP ${response.status}.`);
    }
  }

  if (input.provider === "webflow") {
    const response = await fetch(`https://api.webflow.com/v2/collections/${input.collectionId}`, {
      headers: {
        authorization: `Bearer ${input.apiToken}`,
      },
    });

    if (!response.ok) {
      throw new ConnectionsUpdateError(`Webflow rejected the credentials with HTTP ${response.status}.`);
    }
  }

  if (input.provider === "plausible") {
    const response = await fetch("https://plausible.io/api/v2/query", {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        site_id: input.siteId,
        metrics: ["visitors"],
        date_range: "7d",
      }),
    });

    if (!response.ok) {
      throw new ConnectionsUpdateError(`Plausible rejected the credentials with HTTP ${response.status}.`);
    }
  }
}

function serializeProviderCredentials(input: SaveConnectionCredentialsInput) {
  if (input.provider === "ghost") {
    return {
      adminUrl: input.adminUrl,
      adminApiKey: input.adminApiKey,
      apiVersion: input.apiVersion,
    };
  }

  if (input.provider === "wordpress") {
    return {
      siteUrl: input.siteUrl,
      username: input.username,
      applicationPassword: input.applicationPassword,
    };
  }

  if (input.provider === "webflow") {
    return {
      apiToken: input.apiToken,
      collectionId: input.collectionId,
      bodyFieldSlug: input.bodyFieldSlug,
      summaryFieldSlug: input.summaryFieldSlug,
      metaTitleFieldSlug: input.metaTitleFieldSlug,
      metaDescriptionFieldSlug: input.metaDescriptionFieldSlug,
    };
  }

  return {
    siteId: input.siteId,
    apiKey: input.apiKey,
  };
}

function createGhostAdminToken(apiKey: string) {
  const [id, secret] = apiKey.split(":");

  if (!id || !secret) {
    throw new ConnectionsUpdateError("Ghost Admin API key must use the id:secret format.");
  }

  const header = Buffer.from(JSON.stringify({ alg: "HS256", kid: id, typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ aud: "/admin/", exp: now + 5 * 60, iat: now })).toString("base64url");
  const signature = createHmac("sha256", Buffer.from(secret, "hex"))
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

function normalizeUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
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
