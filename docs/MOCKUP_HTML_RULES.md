# MOCKUP_HTML_RULES

This file governs how Codex should use the future `mockup_html/` directory.

## Authority model
`mockup_html/` is the visual implementation reference, not the product-behavior authority.

Use `mockup_html/` for:
- layout composition
- spacing and density
- surface hierarchy
- responsive visual structure
- component visual treatment
- interaction polish suggested by the markup and CSS

Do not use `mockup_html/` as authority for:
- route contracts
- permissions
- validation
- business logic
- server actions
- workflow eligibility
- state transitions
- security rules

## Implementation rule
Convert the mockups into production UI components:
- extract reusable primitives
- preserve accessibility
- integrate real data and loading/error states
- do not keep static placeholder content beyond initial scaffolding

## Conflict rule
If a mockup conflicts with this suite:
1. preserve product behavior from the docs
2. preserve the mockup visually as much as possible
3. record the conflict in `OPEN_QUESTIONS.md`
