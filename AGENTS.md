# AGENTS.md

This file contains the durable repository rules for Codex.

## Mission
Build and maintain the LaunchPilot webapp from the canonical docs in this repository.

## Read this first
For every task:
1. Read `docs/TASK_ENTRYPOINTS.md`
2. Read only the docs listed for the task type
3. Read `docs/MOCKUP_HTML_RULES.md` if `mockup_html/` exists and the task touches UI

## Non-negotiable rules
- Do not invent requirements, workflows, permissions, integrations, or states.
- If a requirement is missing, ambiguous, or contradictory, write `[UNSPECIFIED — REQUIRES PRODUCT DECISION]` in `docs/OPEN_QUESTIONS.md` and choose the safest implementation path that does not expand scope.
- Keep changes scoped to the requested slice.
- Do not perform drive-by refactors.
- Do not move business authority into the client.
- Approval decisions, trust gating, plan enforcement, publishing, credentials use, and automation eligibility must remain server-authoritative.
- Do not implement out-of-scope v1 features unless the task explicitly says to do so.
- Prefer extending existing primitives over creating near-duplicate patterns.

## Required architecture posture
- Modular monolith, not microservices, for v1.
- Thin route handlers.
- Service-layer orchestration.
- Shared typed schemas.
- Explicit persistence models.
- Durable background jobs for multi-step AI and integration workflows.
- Safe resumption and retry behavior for long-running flows.

## Documentation rules
- If code changes a product contract, update the relevant doc in `docs/` within the same change.
- Update `docs/IMPLEMENTATION_CHECKLIST.md` when a checklist item is completed.
- Record contradictions, unresolved gaps, and decisions requiring product input in `docs/OPEN_QUESTIONS.md`.

## UI rules
- Use `mockup_html/` as the visual authority when present.
- Preserve the product behavior from the docs even if a mockup implies something else.
- Do not copy static mockup HTML directly into production without componentization and accessibility work.

## Security rules
- Never expose encrypted credentials, raw provider secrets, or privileged worker operations to the client.
- Enforce tenant boundaries everywhere.
- Prefer deny-by-default authorization.
- Public endpoints must be rate-limited and minimal.

## Delivery rules
- Work in small slices.
- State which docs were used.
- Keep implementation notes tied to explicit checklist items or doc sections.
