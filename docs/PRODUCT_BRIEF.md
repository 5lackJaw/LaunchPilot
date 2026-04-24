# PRODUCT_BRIEF

## Product summary
LaunchPilot is an AI-assisted marketing execution platform for solo developers and indie founders. The system reduces the user's role to product decisions and periodic approval, while the platform handles downstream marketing execution: marketing brief generation, content drafting, community drafting, directory listing preparation, outreach drafting, publishing, analytics ingestion, and weekly summaries.

## Product vision
A solo developer should be able to launch a SaaS product and generate meaningful qualified traffic without needing marketing expertise. The product is optimized for builders with limited weekly marketing time.

## Primary user
- technical founder / solo developer / indie founder
- low tolerance for marketing jargon
- comfortable with technical SaaS tooling
- limited time for repeated manual marketing work

## Core product loop
1. User signs up and creates a product.
2. User submits a product URL.
3. System crawls the product and generates an initial Marketing Brief.
4. User completes a guided interview that enriches the brief.
5. System generates assets and proposed actions.
6. Actions surface in the Approval Inbox.
7. Approved items publish, submit, or send via integrations.
8. Analytics and performance signals feed the dashboard and weekly digest.
9. The brief may be refreshed later based on new crawl and performance data.

## Major modules
### 1. Onboarding and intelligence
- crawl product URL
- extract product signals
- identify competitors and keywords
- run guided interview
- generate persistent Marketing Brief

### 2. Positioning engine
Generate product-level copy such as headline/subheadline, feature bullets, FAQ, meta description, social bio variants, product launch taglines, cold email subject lines, and elevator pitches.

### 3. SEO content pipeline
Generate long-form guides, comparisons, best-of posts, FAQ pages, and changelog/update posts. Support publishing to Ghost, WordPress, Webflow, and Markdown export to GitHub-backed static sites.

### 4. Community intelligence
Monitor high-relevance community threads, score relevance, draft non-promotional helpful replies, gate output through authenticity guardrails, and optionally auto-post depending on trust level.

### 5. Directory and listing agent
Prepare directory-specific listing packages, submit automatically where supported, and track submission lifecycle.

### 6. Cold outreach composer
Identify relevant writers/bloggers/newsletters, draft individualized outreach, track status, and schedule follow-up.

### 7. Approval Inbox
This is the primary work surface. All automated actions appear here before execution unless trust level allows safe auto-execution.

### 8. Analytics dashboard
Show plain-language performance signals: visits, sources, content performance, keyword movement, community activity, outreach status, and next recommendations.

## v1 primary screens
- onboarding crawl
- onboarding interview
- onboarding brief review
- dashboard
- approval inbox
- content library
- SEO keywords
- community activity
- outreach tracker
- directory tracker
- analytics
- marketing brief editor
- settings: connections, billing, preferences

## Explicit v1 exclusions
- paid ad campaign management
- podcast outreach
- video generation
- full CRM / deal pipeline management
- team workflows / multi-seat approval chains
- white-label / agency mode

## Trust levels
Per channel type, automation is governed by trust levels:
- Level 1: user approves everything
- Level 2: safe lower-risk actions may auto-post; higher-risk actions still require approval
- Level 3: full autopilot within configured limits and guardrails

Low-confidence outputs must still require review regardless of trust level.

## Approval Inbox card families
- content draft
- community reply draft
- directory listing package
- outreach email draft
- positioning copy update
- weekly strategy recommendation

## Product-level constraints
- no marketing jargon in UI copy
- developer-tool feel, not marketer-tool feel
- explain why the system recommended something
- user can stay mostly passive; daily engagement is not required
- human-review fallback must always exist for automation
