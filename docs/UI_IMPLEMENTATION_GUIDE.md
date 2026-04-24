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

Production UI should converge toward the mockups over time. Early scaffolds may use shared primitives and simplified content, but final page implementations should closely resemble the mockup composition while remaining componentized, accessible, and connected to real data.
