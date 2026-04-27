# IMPLEMENTATION_PLAN

This plan is intentionally scoped for AI developers-friendly execution. Build in vertical slices, not giant all-system jumps.

## Phase 0 — foundation
- bootstrap Next.js 16 app, shared types, environment handling, Supabase wiring, auth shell, base layout, design primitives
- set up worker/orchestration skeleton and billing skeleton

## Phase 1 — onboarding and brief
- product creation
- crawl trigger and progress surface
- interview flow
- brief generation workflow
- brief review/editor

## Phase 2 — approval inbox backbone
- inbox entity and review actions
- item detail rendering by card family
- approval/reject/skip flows
- audit trail

## Phase 3 — content pipeline
- keyword opportunity selection
- content generation workflow
- content library
- publishing adapters: Markdown export first, then Ghost/WordPress/Webflow

## Phase 4 — dashboard and analytics baseline
- dashboard summary
- top sources
- content performance
- weekly recommendation generation

## Phase 5 — directory agent
- curated directory model
- package generation
- submission tracking
- partial automation for supported directories

## Phase 6 — community intelligence
- thread ingestion and scoring
- reply draft generation
- authenticity guardrails
- trust-level behavior
- approval/posting flow

## Phase 7 — outreach composer
- prospect identification
- draft generation
- send and follow-up scheduling
- outreach tracker

## Phase 8 — hardening
- error states
- empty states
- plan enforcement
- mobile polish
- connection health checks
- observability improvements

## Slice rule
Each implementation slice should ideally:
- touch one main user-visible outcome
- have one clear definition of done
- avoid spanning unrelated modules
- update checklist state when complete
