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
- Current implication: Low practical risk for LaunchPilot because the app does not accept user-submitted CSS, run PostCSS on user input, or embed PostCSS-stringified user CSS into HTML `<style>` tags.
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
