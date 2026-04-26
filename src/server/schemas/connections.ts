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

export type ConnectionProvider = z.infer<typeof connectionProviderSchema>;
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export type ExternalConnection = z.infer<typeof externalConnectionSchema>;
