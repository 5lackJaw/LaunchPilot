import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("LaunchPilot"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalNonEmptyString,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalNonEmptyString,
  SUPABASE_SECRET_KEY: optionalNonEmptyString,
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmptyString,
  STRIPE_SECRET_KEY: optionalNonEmptyString,
  STRIPE_WEBHOOK_SECRET: optionalNonEmptyString,
  STRIPE_LAUNCH_PRICE_ID: optionalNonEmptyString,
  STRIPE_GROWTH_PRICE_ID: optionalNonEmptyString,
  INNGEST_EVENT_KEY: optionalNonEmptyString,
  INNGEST_SIGNING_KEY: optionalNonEmptyString,
  ENABLE_DEV_INBOX_SEED: optionalNonEmptyString,
  GHOST_ADMIN_URL: optionalUrl,
  GHOST_ADMIN_API_KEY: optionalNonEmptyString,
  GHOST_API_VERSION: z.string().default("v6.0"),
  WORDPRESS_SITE_URL: optionalUrl,
  WORDPRESS_USERNAME: optionalNonEmptyString,
  WORDPRESS_APPLICATION_PASSWORD: optionalNonEmptyString,
  WEBFLOW_API_TOKEN: optionalNonEmptyString,
  WEBFLOW_COLLECTION_ID: optionalNonEmptyString,
  WEBFLOW_BODY_FIELD_SLUG: z.string().default("body"),
  WEBFLOW_SUMMARY_FIELD_SLUG: z.string().default("summary"),
  WEBFLOW_META_TITLE_FIELD_SLUG: z.string().default("meta-title"),
  WEBFLOW_META_DESCRIPTION_FIELD_SLUG: z.string().default("meta-description"),
  RESEND_API_KEY: optionalNonEmptyString,
  WEEKLY_DIGEST_FROM_EMAIL: optionalNonEmptyString,
  SENTRY_DSN: optionalNonEmptyString,
});

export const env = envSchema.parse(process.env);

export const supabasePublicKey =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabaseSecretKey =
  env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
