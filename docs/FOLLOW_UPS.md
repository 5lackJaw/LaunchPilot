# FOLLOW_UPS

Track non-blocking technical risks, dependency watch items, cleanup tasks, and implementation notes that should not stop the current slice but should be revisited.

This document is not for missing product decisions. Use `docs/OPEN_QUESTIONS.md` when product input is required.

Format:
- Date:
- Area:
- Item:
- Current implication:
- Follow-up trigger:
- Safe current behavior:

- Date: 2026-04-25
- Area: Dependency security
- Item: `npm audit --omit=dev` reports a moderate PostCSS advisory (`GHSA-qx2v-qp2m-jg93`) through Next.js 16.2.4's bundled `next/node_modules/postcss@8.4.31`.
- Current implication: Low practical risk for LaunchBeacon because the app does not accept user-submitted CSS, run PostCSS on user input, or embed PostCSS-stringified user CSS into HTML `<style>` tags.
- Follow-up trigger: Re-check when upgrading Next.js, when Next publishes a release that bumps bundled PostCSS to `8.5.10+`, or before adding any feature that accepts custom CSS from users.
- Safe current behavior: Do not run `npm audit fix --force`, because npm currently suggests a breaking downgrade to `next@9.3.3`; keep Next.js 16 current and avoid user-controlled CSS processing.

- Date: 2026-04-25
- Area: Development test data
- Item: Inbox visual/workflow testing can use locally seeded inbox items when `ENABLE_DEV_INBOX_SEED=1`.
- Current implication: Seed rows are intentionally tagged with `source_entity_type = 'dev_seed'` and can be cleared from the inbox UI, so unfinished generator workflows do not block manual inbox inspection.
- Follow-up trigger: Before production deployment, before demoing against production-like data, or when real content/community/directory generators begin creating inbox items.
- Safe current behavior: The seed UI is disabled by default, hidden in `NODE_ENV=production`, and production inbox reads suppress `dev_seed` rows if any were accidentally present.

- Date: 2026-04-25
- Area: SEO content planning
- Item: Keyword opportunity priority is currently deterministic from Marketing Brief keyword clusters and content calendar seeds.
- Current implication: The `/seo` selection flow is usable before analytics/rank data exists, but the score is not yet based on live volume, difficulty, conversion, or rank movement signals.
- Follow-up trigger: When Phase 4 analytics and keyword movement data are available, or before treating priority score as a production recommendation.
- Safe current behavior: Label the value as priority, keep the rationale visible, and use it only to order generated opportunities from the current brief.

- Date: 2026-04-25
- Area: Article generation
- Item: The Phase 3 article generation workflow currently uses deterministic draft composition rather than an AI provider.
- Current implication: The workflow exercises the durable pipeline, content asset updates, and approval inbox handoff, but generated copy is placeholder-quality and should not be treated as production-ready.
- Follow-up trigger: When Anthropic/OpenAI generation is wired, replace the deterministic composer with the provider-backed outline, draft, and SEO review steps.
- Safe current behavior: Keep generated content in `pending_review`, create an inbox item, and require human review before publishing or export.

- Date: 2026-04-25
- Area: Ghost publishing
- Item: Ghost publishing is currently configured with server environment variables instead of encrypted per-user connections.
- Current implication: The adapter can create Ghost drafts for local/server-configured testing, but it is not yet the final multi-tenant connection model.
- Follow-up trigger: When the connections settings area and encrypted `external_connections` storage are implemented.
- Safe current behavior: Keep Ghost Admin API credentials server-only, never expose them to the client, and create drafts rather than directly publishing live posts.

- Date: 2026-04-25
- Area: WordPress publishing
- Item: WordPress publishing is currently configured with server environment variables and Application Passwords instead of encrypted per-user connections.
- Current implication: The adapter can create WordPress drafts for local/server-configured testing, but it is not yet the final multi-tenant OAuth/connection model.
- Follow-up trigger: When the connections settings area and encrypted `external_connections` storage are implemented.
- Safe current behavior: Keep WordPress credentials server-only, use draft status, and require review before any live publishing workflow is added.

- Date: 2026-04-25
- Area: Webflow publishing
- Item: Webflow publishing is currently configured with server environment variables and collection field slugs instead of encrypted per-user connections.
- Current implication: The adapter can create staged CMS items for one configured collection, but it is not yet the final multi-tenant connection and collection-mapping model.
- Follow-up trigger: When the connections settings area and encrypted `external_connections` storage are implemented.
- Safe current behavior: Keep the API token server-only, create draft/staged CMS items, and require explicit collection field mapping through environment variables.

- Date: 2026-04-25
- Area: Analytics baseline
- Item: Phase 4 dashboard and analytics views now read from durable `traffic_snapshots` and `keyword_rank_snapshots`, but content-level traffic attribution is not yet ingested.
- Current implication: The UI can show real traffic by source, keyword movement, content lifecycle status, and tracked keyword rank per asset. Per-asset visits and conversions remain zero until analytics ingestion can map URLs or provider events back to `content_assets`.
- Follow-up trigger: When website analytics, Search Console, Plausible, PostHog, or equivalent ingestion is implemented.
- Safe current behavior: Keep the content performance surface server-backed, show explicit empty/zero metric states, and avoid presenting per-asset visit counts as measured until attribution exists.

- Date: 2026-04-25
- Area: Supabase Auth security
- Item: `supabase db advisors --linked` reports leaked password protection is disabled.
- Current implication: Supabase Auth will not reject passwords found in known breach datasets until the project-level setting is enabled.
- Follow-up trigger: Before inviting real users or deploying the app publicly.
- Safe current behavior: Keep this as a deployment-readiness item because it is controlled in Supabase Auth settings, not by repository code.

- Date: 2026-04-25
- Area: Weekly digest email
- Item: Weekly digest delivery uses Resend when `RESEND_API_KEY` and `WEEKLY_DIGEST_FROM_EMAIL` are configured.
- Current implication: In local or unconfigured environments, the workflow still persists `weekly_briefs` and creates a weekly recommendation inbox item, but it skips email delivery and leaves `sent_at` empty.
- Follow-up trigger: Before live deployment or when choosing the final production email provider/sender domain.
- Safe current behavior: Keep email credentials server-only and require explicit provider configuration before sending external email.

- Date: 2026-04-26
- Area: Directory integrations
- Item: Directory auto-submit is currently a server-side supported-directory adapter path with durable provenance, not a live external provider integration.
- Current implication: The app can safely auto-submit only catalog entries marked `auto_supported`, but the seeded directory catalog remains manual/assisted until real directory APIs or credentialed flows are configured.
- Follow-up trigger: Before enabling any production directory auto-submit provider.
- Safe current behavior: The server rejects unsupported directories and pending submissions without generated listing packages; manual and assisted directories remain review-gated.

- Date: 2026-04-26
- Area: Community intelligence
- Item: Thread ingestion currently uses deterministic Marketing Brief-derived candidates rather than live Reddit, Hacker News, or other community APIs.
- Current implication: The Phase 6 pipeline can persist and score observed community threads, but it should not be treated as live monitoring yet.
- Follow-up trigger: When external community connections, polling, OAuth, or provider-specific API limits are implemented.
- Safe current behavior: Store provenance on every observed thread, keep replies ungenerated, and require later review-gated workflows before any posting action exists.

- Date: 2026-04-26
- Area: Community posting
- Item: Approved community replies currently use a simulated server-side posting adapter instead of live Reddit, Hacker News, or social credentials.
- Current implication: Approving a community reply can transition the LaunchBeacon thread record to `posted` with audit provenance, but no external community platform receives the reply yet.
- Follow-up trigger: When encrypted community connections and provider-specific posting adapters are implemented.
- Safe current behavior: Keep the action server-authoritative, require an approved review path, require a draft, and block replies whose promotional score exceeds the guardrail threshold.

- Date: 2026-04-26
- Area: Outreach prospecting
- Item: Prospect identification currently uses deterministic Marketing Brief-derived candidates rather than live media databases, search APIs, or email discovery providers.
- Current implication: The outreach pipeline can persist and rank contacts, but contacts should not be treated as verified real outreach targets yet.
- Follow-up trigger: When external prospect data providers, enrichment, or email verification are implemented.
- Safe current behavior: Store provenance for every prospect, keep email nullable, and require later review before any sending workflow exists.

- Date: 2026-04-26
- Area: Outreach sending
- Item: Approved outreach emails currently use a simulated server-side sending adapter instead of live email provider credentials.
- Current implication: Approving an outreach email can transition the contact to `sent` with audit provenance, but no external email is delivered yet.
- Follow-up trigger: When encrypted email provider connections, sender identity, and unsubscribe/suppression enforcement are implemented.
- Safe current behavior: Keep sending server-authoritative, require inbox approval, and record `last_contact_at` only after the simulated send path succeeds.

- Date: 2026-04-26
- Area: Outreach compliance
- Item: Suppression is currently enforced as product-local contact state in `outreach_contacts`, not as a global unsubscribe/suppression registry.
- Current implication: LaunchBeacon blocks suppressed contacts from app-level draft generation, sending, and follow-up scheduling for the current product, but production email delivery will need provider-level suppression and unsubscribe handling.
- Follow-up trigger: Before enabling live email sending or adding encrypted email provider connections.
- Safe current behavior: Keep suppression server-authoritative, store suppression provenance, and reject all outreach actions for suppressed contacts.

- Date: 2026-04-26
- Area: Connection management
- Item: `/settings/connections` stores setup/revocation status and shows server-env configured providers, but does not yet collect encrypted credentials or run provider OAuth callbacks.
- Current implication: Users can see provider readiness and mark setup intent, while live integrations still rely on server environment variables or simulated adapters.
- Follow-up trigger: When implementing each production provider connection flow.
- Safe current behavior: Never accept raw secrets in the browser, never expose server environment values, and clear stored credentials on revocation.

- Date: 2026-04-26
- Area: Stripe billing
- Item: `/settings/billing` supports Checkout and Customer Portal when `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_LAUNCH_PRICE_ID`, and `STRIPE_GROWTH_PRICE_ID` are configured, but final Stripe products/prices are not committed in the repo.
- Current implication: Local and production environments can wire real Stripe prices through environment variables; missing prices leave checkout buttons disabled.
- Follow-up trigger: Before public launch or any paid user testing.
- Safe current behavior: Create Checkout and Portal sessions server-side only, verify webhook signatures, and update `users.plan_tier` only from signed Stripe events.

- Date: 2026-04-27
- Area: Product onboarding cleanup
- Item: Live testing exposed duplicate product rows for the same URL before duplicate detection ran ahead of plan-limit enforcement.
- Current implication: New duplicate product creation is blocked in the service layer and onboarding reopens the existing product, but existing duplicate rows may still need manual cleanup or consolidation.
- Follow-up trigger: Before inviting external users, after confirming which duplicate product row contains the desired crawl/brief state, or when adding a full product management page.
- Safe current behavior: Onboarding loads an existing product when no `productId` is provided, duplicate URL submissions redirect to the existing product, and the UI exposes existing products on the onboarding crawl page.

- Date: 2026-04-27
- Area: Product switching
- Item: The mockup-style topbar previously implied a product switcher, but no product-switching workflow has been implemented across all app routes.
- Current implication: The topbar now shows only the current product name when a page provides one and no longer renders a non-functional dropdown.
- Follow-up trigger: When adding a product management surface or route-level product selection across dashboard, inbox, analytics, and channel pages.
- Safe current behavior: Product context remains server-selected per route, and onboarding includes explicit resume links for existing products.
