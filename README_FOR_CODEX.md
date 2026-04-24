# LaunchPilot Codex Suite (Trimmed)

This suite is designed for Codex to build the entire LaunchPilot webapp without requiring Codex to hold the entire product in active context at once.

## Operating model
Use this suite as a layered reference system:
- `AGENTS.md` = durable repo rules and required behavior
- `docs/TASK_ENTRYPOINTS.md` = which docs to read for a given task
- task-specific docs = the contract for the slice being implemented
- `mockup_html/` = future visual authority for layout, density, and interaction polish

Do **not** preload every document for every task. Read only the docs required for the current slice.

## What LaunchPilot is
LaunchPilot is a multi-tenant SaaS for solo developers and indie founders. It crawls a product URL, generates a persistent Marketing Brief, creates and routes marketing work through an Approval Inbox, publishes approved assets through integrations, and shows plain-language performance analytics. The product is conceptually structured as:
- Intelligence layer: crawl, interview, brief generation, keyword and competitor analysis
- Execution layer: content generation, community drafting, directory packages, outreach drafts
- Feedback layer: analytics ingestion, summaries, recommendations, performance tracking

## Baseline stack
- Next.js 14 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Route Handlers + tRPC
- Supabase Postgres/Auth/Storage/Realtime
- Inngest for durable workflows
- Railway for long-running workers
- Anthropic Claude Sonnet 4.6 for generation and analysis
- OpenAI text-embedding-3-small for clustering/search
- Resend for transactional email and weekly digest
- Stripe for subscriptions and billing
- Plausible, optionally GA4 + GSC, for analytics
- Sentry for monitoring

## Use of mockup_html/
 
- Treat it as the **visual UI basis**.
- Use it for layout, spacing density, composition, surface hierarchy, and interaction polish.
- Do not treat it as authority for business logic, permissions, route contracts, validation, or state transitions.
- If a mockup conflicts with product behavior in this suite, preserve the behavior from this suite and record the conflict in `docs/OPEN_QUESTIONS.md`.
- Convert mockups into production Next.js components; do not ship static HTML copies.

## Minimal reading order
1. `AGENTS.md`
2. `docs/TASK_ENTRYPOINTS.md`
3. only the docs required for the current task

## Expected development style
- modular monolith first
- server-authoritative business logic
- strongly typed validation and contracts
- small, reviewable slices
- explicit state transitions
- safe fallback to human review
- no invented product behavior

## Important concerning app name

LaunchPilot is a temporary name for the application, and is subject to change. For that reason, ensure that changing all instances of the name throughout the codebase can be done with relative ease down the line. 