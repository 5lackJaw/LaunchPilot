import { z } from "zod";

export const connectionProviderSchema = z.enum([
  "ghost",
  "wordpress",
  "webflow",
  "reddit",
  "hacker_news",
  "google_search_console",
  "plausible",
  "resend",
  "outreach_email",
]);

export const connectionStatusSchema = z.enum([
  "pending",
  "connected",
  "revoked",
  "error",
]);

export const externalConnectionSchema = z.object({
  id: z.string().uuid().nullable(),
  userId: z.string().uuid().nullable(),
  provider: connectionProviderSchema,
  label: z.string(),
  category: z.enum(["Publishing", "Community", "Analytics", "Email"]),
  description: z.string(),
  scopes: z.array(z.string()),
  status: connectionStatusSchema,
  source: z.enum(["database", "server_env", "not_configured"]),
  lastValidatedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const connectionProviderInputSchema = z.object({
  provider: connectionProviderSchema,
});

const optionalSlugSchema = z.string().trim().min(1).max(80).optional();

export const saveConnectionCredentialsSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("ghost"),
    adminUrl: z.string().trim().url(),
    adminApiKey: z.string().trim().min(20).max(400),
    apiVersion: z.string().trim().min(1).max(20).default("v6.0"),
  }),
  z.object({
    provider: z.literal("wordpress"),
    siteUrl: z.string().trim().url(),
    username: z.string().trim().min(1).max(160),
    applicationPassword: z.string().trim().min(8).max(400),
  }),
  z.object({
    provider: z.literal("webflow"),
    apiToken: z.string().trim().min(20).max(500),
    collectionId: z.string().trim().min(6).max(160),
    bodyFieldSlug: optionalSlugSchema.default("body"),
    summaryFieldSlug: optionalSlugSchema.default("summary"),
    metaTitleFieldSlug: optionalSlugSchema.default("meta-title"),
    metaDescriptionFieldSlug: optionalSlugSchema.default("meta-description"),
  }),
  z.object({
    provider: z.literal("plausible"),
    siteId: z.string().trim().min(3).max(160),
    apiKey: z.string().trim().min(10).max(500),
  }),
]);

export type ConnectionProvider = z.infer<typeof connectionProviderSchema>;
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export type ExternalConnection = z.infer<typeof externalConnectionSchema>;
export type SaveConnectionCredentialsInput = z.infer<typeof saveConnectionCredentialsSchema>;
