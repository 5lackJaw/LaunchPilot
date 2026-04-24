# ARCHITECTURE

## Top-level approach
LaunchPilot should be built as a modular monolith with durable background workflows. Do not split into microservices for v1.

## Primary subsystems

### 1. Web application
Responsibilities:
- authentication
- settings and connections UI
- approval inbox UI
- dashboard and analytics UI
- manual editing and review flows

Recommended implementation:
- Next.js App Router
- server components by default where practical
- client components only for interactive islands

### 2. Persistence layer
Responsibilities:
- tenant-scoped relational data
- auth
- file storage for logos/screenshots/generated exports
- realtime subscription support if used

Recommended implementation:
- Supabase Postgres
- Supabase Auth
- Supabase Storage

### 3. AI pipeline layer
Responsibilities:
- crawl analysis
- brief generation
- article generation
- community drafting
- outreach drafting
- weekly summary generation

Recommended implementation:
- Inngest step functions for orchestration, retry, resume, observability
- Anthropic for generation and analysis
- embeddings for clustering/search tasks

### 4. Worker layer
Responsibilities:
- recurring monitoring jobs
- long-running event-driven agents
- integration polling or scheduling where applicable

Recommended implementation:
- Railway-hosted worker runtime where long-running processes are needed
- Inngest-triggered job execution

### 5. Integration layer
Responsibilities:
- CMS publishing
- community platform posting/monitoring
- analytics ingestion
- email delivery
- Stripe billing

## AI workflow design
All multi-step generation and automation flows should be orchestrated as durable workflows, not inline request/response only.

Recommended workflow families:
- `brief_generation`: crawl -> extract -> competitor discovery -> keyword clustering -> brief generation
- `content_generation`: select keyword -> outline -> draft -> SEO review -> final asset creation -> inbox item creation
- `community_reply_generation`: detect thread -> score relevance -> draft reply -> authenticity check -> inbox item creation or auto-post eligibility
- `directory_package_generation`: load directory metadata -> generate listing payload -> inbox item creation or submission path
- `outreach_generation`: identify prospect -> research hook -> draft email -> quality check -> inbox item creation
- `weekly_digest_generation`: aggregate metrics -> summarize -> recommend next steps -> send digest

## Service boundaries
Use a service layer rather than bloated routes.

Recommended service domains:
- auth service
- product service
- brief service
- inbox service
- content service
- community service
- directory service
- outreach service
- analytics service
- connections service
- billing service
- workflow orchestration service

## Data and event posture
- routes trigger service methods
- service methods persist state and emit workflow events where needed
- background workflows create or update durable entities and inbox items
- approval actions transition durable state and may trigger downstream execution workflows

## Plan and quota enforcement
Plan limits and overages must be enforced server-side against durable usage counts. Do not trust client-side limits.

## Publishing posture
Publishing integrations should be abstracted behind provider adapters. Provider-specific credential handling and API semantics must stay out of UI components.

## Observability posture
- Sentry for exceptions and traceable failures
- structured workflow logs
- audit visibility for review/execution actions

## Deployment posture
- Vercel for web app
- Railway for workers
- Supabase-hosted Postgres/Auth/Storage
- external provider secrets stored server-side only
