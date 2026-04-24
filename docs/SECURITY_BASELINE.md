# SECURITY_BASELINE

## Core rules
- strict tenant isolation
- server-authoritative mutations
- encrypted provider credentials at rest
- least-privilege access for integrations
- rate-limited public endpoints
- auditable approval and execution actions

## Auth and authorization
- use Supabase Auth for identity
- all product-scoped data access must be tenant-checked
- UI visibility is not sufficient authorization; enforce on the server

## Credentials and provider connections
- store external credentials encrypted at rest
- never expose raw provider credentials to the client
- use provider adapters on the server

## AI and generated content
- generated artifacts should carry provenance metadata
- low-confidence outputs must be review-gated regardless of trust level
- use provider features or settings that avoid model training on user data where supported

## Public endpoints
- public routes should be minimal
- rate-limit unauthenticated endpoints
- avoid returning sensitive product internals via public surfaces

## Compliance baseline
- provide user data export path
- provide deletion path
- retain review logs and analytics data according to configured retention policy
