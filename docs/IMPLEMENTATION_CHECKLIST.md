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
- [ ] Inbox item persistence model
- [ ] Inbox list page
- [ ] Inbox detail rendering by item type
- [ ] Approve action
- [ ] Reject action with reason
- [ ] Skip action
- [ ] Batch actions for supported items
- [ ] Review audit trail

## Phase 3 — content pipeline
- [ ] Keyword opportunity selection flow
- [ ] Article generation workflow
- [ ] Content asset storage model
- [ ] Content library page
- [ ] Content detail/editor page
- [ ] Markdown export
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
