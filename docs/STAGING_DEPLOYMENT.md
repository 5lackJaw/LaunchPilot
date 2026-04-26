# STAGING_DEPLOYMENT

Use this runbook to get LaunchPilot online in a private/staging environment before public launch.

## Current status

- Phase 0 through Phase 8 implementation checklist is complete.
- Remote Supabase migrations are in sync as of 2026-04-26.
- `npm audit --omit=dev` still reports the known moderate PostCSS advisory already tracked in `docs/FOLLOW_UPS.md`.
- Supabase advisors report one deployment-readiness warning: leaked password protection is disabled.
- Vercel CLI is installed locally, but this machine is not authenticated to Vercel yet.

## Required provider setup

### Vercel

1. Run `npx vercel login`.
2. Link or create the project:
   - `npx vercel link --yes --project launchpilot`
3. Add production and preview environment variables in Vercel.
4. Deploy a preview first:
   - `npx vercel`
5. After preview verification, deploy production:
   - `npx vercel --prod`

### Supabase

1. Confirm migrations:
   - `npm run supabase:db:push`
   - `.\\node_modules\\.bin\\supabase.cmd migration list --linked`
2. In Supabase Auth URL Configuration:
   - Set Site URL to the final Vercel production URL.
   - Add allowed redirect URLs for the production URL and any preview/staging URL you intend to test.
3. In Supabase Auth password settings, enable leaked password protection before inviting users.
4. Keep using the new key names:
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`

### Inngest

1. Create a staging or production Inngest environment.
2. Add these Vercel environment variables:
   - `INNGEST_EVENT_KEY`
   - `INNGEST_SIGNING_KEY`
3. Confirm the deployed endpoint is reachable:
   - `https://<deployment-host>/api/inngest`
4. Prefer the Inngest Vercel integration for automatic sync on deploy.

### Stripe

1. Create final Launch and Growth prices.
2. Add:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_LAUNCH_PRICE_ID`
   - `STRIPE_GROWTH_PRICE_ID`
3. Configure the webhook endpoint:
   - `https://<deployment-host>/api/stripe/webhook`

### Resend

1. Verify the sender domain.
2. Add:
   - `RESEND_API_KEY`
   - `WEEKLY_DIGEST_FROM_EMAIL`

### Sentry

1. Create the Sentry project.
2. Add:
   - `SENTRY_DSN`
   - `NEXT_PUBLIC_SENTRY_DSN`
   - `SENTRY_ORG`
   - `SENTRY_PROJECT`
   - `SENTRY_AUTH_TOKEN`

## Minimum Vercel environment variables

Set these for staging/production:

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`

Optional but needed for full provider paths:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_LAUNCH_PRICE_ID`
- `STRIPE_GROWTH_PRICE_ID`
- `RESEND_API_KEY`
- `WEEKLY_DIGEST_FROM_EMAIL`
- `GHOST_ADMIN_URL`
- `GHOST_ADMIN_API_KEY`
- `WORDPRESS_SITE_URL`
- `WORDPRESS_USERNAME`
- `WORDPRESS_APPLICATION_PASSWORD`
- `WEBFLOW_API_TOKEN`
- `WEBFLOW_COLLECTION_ID`

Do not set `ENABLE_DEV_INBOX_SEED=1` in production.

## Staging verification checklist

1. Sign up and sign in.
2. Create a product.
3. Run onboarding crawl and confirm it completes without the Next.js error overlay.
4. Complete interview answers.
5. Generate and edit the Marketing Brief.
6. Select a keyword and generate a content draft.
7. Review the generated inbox item.
8. Export a content asset as Markdown.
9. Visit `/settings/connections`, `/settings/billing`, `/settings/preferences`, and `/settings/account`.
10. Download the account JSON export and confirm no raw encrypted credentials are included.
11. Check Vercel function logs and Sentry for runtime errors.
12. Check Inngest for successful function sync and workflow runs.

## Public launch blockers

These do not block a private staging deployment, but they should block inviting real users:

- Final product/pricing limits are still a product decision.
- Data retention policy is still a product/legal decision.
- Supabase leaked password protection must be enabled.
- OAuth and encrypted per-user connection flows are not implemented yet.
- Live analytics ingestion is not implemented yet.
- Live community posting and outreach sending are simulated.
- Email sender domain and Stripe products/prices must be finalized.
