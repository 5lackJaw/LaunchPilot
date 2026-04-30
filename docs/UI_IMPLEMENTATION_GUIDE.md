# UI_IMPLEMENTATION_GUIDE

## Product UI posture
The UI should feel like a developer tool rather than a marketing platform. Favor clarity, density, and auditability over decorative marketing styling.

## Visual principles
- high information density without clutter
- low-noise surface hierarchy
- clear state color usage only where meaningful
- plain language, not marketing jargon
- every screen has one obvious primary action
- show why the system recommended something

## Design influences
The source concept points toward a GitHub / Linear / Vercel-like posture: structured, restrained, efficient, and legible.

## Primary app surfaces

### Dashboard
Purpose:
- weekly summary
- top metrics
- inbox preview
- next actions

Must answer:
- are things moving?
- what is working?
- what requires review?

### Approval Inbox
This is the central work surface.

Each card should expose:
- item type badge
- title
- short preview
- confidence indicator
- estimated impact
- time to review
- one clear primary action
- secondary actions in overflow or compact secondary controls

Card families:
- content draft
- community reply
- directory package
- outreach email
- positioning update
- weekly recommendation

### Content / SEO / Community / Outreach / Directories / Analytics
These routes should follow a common pattern:
- top summary bar
- filters / tabs if needed
- primary data table or card list
- detail panel or dedicated detail route
- clear action path from state observation to next action

### Onboarding interview
- conversational flow
- progress visible
- example answer chips allowed
- resumable
- final brief review must be structured and editable

## Interaction rules
- avoid hidden critical actions
- destructive or irreversible actions must confirm
- empty states must be explicit and useful
- loading and background-processing states must be informative, not flashy
- approval and publish/send actions must have clear resulting status feedback

## Accessibility baseline
- keyboard navigable
- visible focus states
- semantic buttons and forms
- sufficient contrast
- avoid color-only meaning for critical states

## Relationship to mockup_html/
When `mockup_html/` exists:
- use it as the primary visual reference
- treat the mockup sizing, spacing, density, color treatment, and placement as target product design, not loose inspiration
- carry the same visual concepts to routes that do not yet have dedicated mockups
- preserve these behavioral rules if the mockups are silent
- where a mockup and this guide differ, prefer the mockup for visual specifics and this guide for behavior

Production UI should be built to look like the corresponding mockup. Early scaffolds may use shared primitives and simplified content, but final page implementations should closely resemble the mockup composition while remaining componentized, accessible, and connected to real data.

## Page layout and design are fixed — implement functionality to fit

The layout, visual structure, and design of each page are **considered complete and should not be changed** when adding or connecting functionality. If a feature or data connection needs to be built, adapt the implementation to fit within the existing UI — do not restructure the page to accommodate it.

Specifically:
- do not change grid layouts, column counts, or panel positions when wiring up real data
- do not introduce new wrapper elements, cards, or sections that aren't already present in the design
- do not alter spacing, typography, color tokens, or component hierarchy as a side effect of a data change
- if a data shape doesn't map cleanly to the existing UI, adapt the data transform — not the UI

## Demo content

Some pages include static placeholder content (demo rows, fake metrics, sample names) to make the design legible before real data is available. This content is **temporary scaffolding only**.

Rules:
- demo content must be removed before a feature is considered production-ready
- demo rows, fake KPI values, placeholder names, and static copy must be replaced with the appropriate server-side data fetching and rendering logic
- if no real data exists yet, the page must show a proper empty state (not demo content) — see the empty state guidelines under Interaction rules
- demo content may be rendered at reduced opacity or behind a visible "sample data" label as a transitional aid during development, but must never ship to users as if it were real

When implementing data connections for a page that currently shows demo content:
1. identify every location where static/demo data is rendered
2. replace each with the equivalent server query or derived value
3. verify the empty state renders correctly when no data exists
4. remove any demo arrays, constants, or fallback static values that are no longer needed
