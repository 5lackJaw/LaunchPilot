# ROUTE_SURFACE_MAP

This file defines the app route inventory and the primary responsibility of each route. It is not an exhaustive API schema.

## App routes

### Public / auth-adjacent
- `/` marketing site / landing page
- `/login`
- `/signup`
- `/pricing`
- `/privacy`
- `/terms`

### Product onboarding
- `/onboarding/crawl` product crawl progress and result capture
- `/onboarding/interview` guided interview flow
- `/onboarding/brief` review/edit generated Marketing Brief

### Main app
- `/dashboard` weekly summary, metrics, inbox preview
- `/inbox` approval queue
- `/content` generated and published content library
- `/seo` keyword clusters, keyword positions, content calendar
- `/community` monitored threads, draft replies, platform health
- `/outreach` prospect pipeline and outreach draft management
- `/directories` directory submission tracking
- `/analytics` traffic and performance analytics
- `/brief` full marketing brief editor

### Settings
- `/settings/connections` integration connection management
- `/settings/billing` billing and Stripe portal entry
- `/settings/preferences` trust levels, review windows, notifications

## API / server responsibilities
Implementation may use route handlers, tRPC, server actions, or a mixed pattern, but the responsibilities below must exist.

### Auth and user bootstrap
- create account
- sign in
- load current user and current plan
- establish first product creation flow

### Product and brief
- create product
- trigger product crawl
- persist crawl results
- save interview answers
- generate brief
- update brief
- refresh brief

### Inbox and actions
- list inbox items
- fetch inbox item detail
- approve item
- reject item with reason
- skip item
- batch approve supported item sets
- execute approved item where relevant

### Content
- list content assets
- fetch content asset detail
- regenerate content asset
- publish content asset
- export content asset to integration target

### Community
- list monitored threads
- fetch draft reply details
- approve and post reply
- block thread
- update trust-level rules

### Directory submissions
- list directories and submission state
- generate listing package
- submit listing where supported
- mark manual progress where required

### Outreach
- list prospects
- fetch outreach draft detail
- approve and send outreach
- suppress prospect
- schedule or execute follow-up

### Analytics
- fetch dashboard metrics
- fetch keyword movement
- fetch content performance
- fetch source/channel breakdowns
- fetch weekly recommendations

### Connections
- start OAuth or credential flow
- complete OAuth callback
- save encrypted credentials
- revoke or disable connection
- validate connection health

### Billing and plan enforcement
- create Stripe checkout
- open customer portal
- ingest Stripe webhook events
- enforce plan limits and overages

## Route behavior constraints
- all mutating actions must be server-authoritative
- all product-scoped routes must enforce tenant boundaries
- unauthenticated public routes must be minimal and rate-limited where needed
- approval decisions must produce auditable status transitions
