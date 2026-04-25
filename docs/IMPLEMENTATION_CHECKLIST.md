# IMPLEMENTATION_CHECKLIST

Use this as the execution checklist. Check items only when fully implemented.

## Phase 0 — foundation
- [x] Initialize Next.js app, TypeScript, Tailwind, shadcn/ui baseline
- [x] Configure Supabase auth, database access, storage wiring
- [x] Add environment and secret handling scaffold
- [x] Add shared schema/validation layer
- [x] Add service layer skeleton
- [x] Add Inngest workflow scaffold
- [x] Add Railway worker scaffold
- [x] Add Stripe baseline wiring
- [x] Add Sentry baseline wiring

## Phase 1 — onboarding and brief
- [x] Product creation flow
- [x] URL crawl trigger and progress UI
- [x] Crawl result persistence
- [x] Guided interview UI
- [x] Interview answer persistence
- [x] Marketing Brief generation workflow
- [x] Brief review UI
- [x] Brief edit and versioning support

## Phase 2 — inbox backbone
- [x] Inbox item persistence model
- [x] Inbox list page
- [x] Inbox detail rendering by item type
- [x] Approve action
- [x] Reject action with reason
- [x] Skip action
- [x] Batch actions for supported items
- [x] Review audit trail

## Phase 3 — content pipeline
- [x] Keyword opportunity selection flow
- [x] Article generation workflow
- [x] Content asset storage model
- [x] Content library page
- [x] Content detail/editor page
- [x] Markdown export
- [ ] Ghost publishing adapter
- [ ] WordPress publishing adapter
- [ ] Webflow publishing adapter

## Phase 4 — analytics baseline
- [ ] Dashboard summary surface
- [ ] Source/channel breakdown
- [ ] Content performance view
- [ ] Keyword movement view
- [ ] Weekly recommendation generation
- [ ] Weekly digest email

## Phase 5 — directory agent
- [ ] Directory catalog model
- [ ] Listing package generation
- [ ] Directory tracker page
- [ ] Submission state transitions
- [ ] Auto-submit support for supported directories
- [ ] Manual flow support for unsupported directories

## Phase 6 — community intelligence
- [ ] Thread ingestion pipeline
- [ ] Relevance scoring
- [ ] Reply draft generation
- [ ] Authenticity guardrail scoring
- [ ] Community page
- [ ] Approve-and-post flow
- [ ] Trust-level configuration

## Phase 7 — outreach composer
- [ ] Prospect identification flow
- [ ] Outreach contact model
- [ ] Outreach draft generation
- [ ] Outreach tracker page
- [ ] Approve-and-send flow
- [ ] Follow-up scheduling
- [ ] Suppression logic

## Phase 8 — hardening
- [ ] Plan and quota enforcement
- [ ] Connection management page
- [ ] Billing page / portal access
- [ ] Mobile polish for primary routes
- [ ] Empty and error states
- [ ] Logging and observability improvements
- [ ] Data export and deletion paths
