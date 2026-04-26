# DOMAIN_MODEL

This file defines the primary persistence and state model.

## Tenancy model
The application is multi-tenant. Every product belongs to a user. Every product-scoped record must carry product ownership. Authorization must deny cross-tenant access by default.

## Core entities

### users
Purpose: account owner.
Fields:
- id
- email
- plan_tier: free | launch | growth
- stripe_customer_id
- created_at

### products
Purpose: root business object for a user's marketed product.
Fields:
- id
- user_id
- name
- url
- status
- current_marketing_brief_id
- created_at

Recommended `products.status`:
- draft
- onboarding
- active
- paused
- archived

### marketing_briefs
Purpose: persistent structured product understanding used by all downstream AI workflows.
Fields:
- id
- product_id
- version
- tagline
- value_props
- personas
- competitors
- keyword_clusters
- tone_profile
- channels_ranked
- content_calendar_seed
- launch_date
- created_at
- updated_at

Rules:
- briefs are versioned
- one brief version is current for a product
- downstream generation references a specific brief version

### crawl_jobs
Purpose: durable crawl trigger and progress record for product onboarding.
Fields:
- id
- product_id
- status
- progress_percent
- steps
- error_message
- created_at
- updated_at
- completed_at

Recommended `crawl_jobs.status`:
- queued
- running
- completed
- failed

Rules:
- crawl jobs belong to a product and must be tenant-checked through product ownership
- crawl jobs are triggered server-side and executed by durable workflow events
- crawl progress must be persisted so onboarding can resume safely

### crawl_results
Purpose: persisted output from a product URL crawl.
Fields:
- id
- product_id
- crawl_job_id
- source_url
- final_url
- http_status
- page_title
- meta_description
- h1
- extracted_signals
- provenance
- created_at

Rules:
- crawl results belong to a product and must be tenant-checked through product ownership
- crawl results store raw crawl-derived signals, not generated Marketing Brief conclusions
- downstream brief generation should reference a specific crawl result

### interview_answers
Purpose: persisted guided onboarding answers that enrich the Marketing Brief.
Fields:
- id
- product_id
- question_id
- answer
- created_at
- updated_at

Rules:
- interview answers belong to a product and must be tenant-checked through product ownership
- one answer is stored per product and question
- answers are user-authored brief inputs, not generated conclusions

### content_assets
Purpose: generated content objects.
Fields:
- id
- product_id
- brief_version
- type
- title
- body_md
- target_keyword
- meta_title
- meta_description
- status
- published_url
- ai_confidence
- provenance
- created_at
- updated_at

Recommended `content_assets.type`:
- article
- comparison
- faq
- changelog
- positioning_copy

Recommended `content_assets.status`:
- draft
- pending_review
- approved
- published
- rejected
- failed
- archived

### inbox_items
Purpose: single review queue for proposed automated actions.
Fields:
- id
- product_id
- item_type
- source_entity_type
- source_entity_id
- payload
- status
- ai_confidence
- impact_estimate
- review_time_estimate_seconds
- created_at
- reviewed_at

Recommended `inbox_items.item_type`:
- content_draft
- community_reply
- directory_package
- outreach_email
- positioning_update
- weekly_recommendation

Recommended `inbox_items.status`:
- pending
- approved
- rejected
- skipped
- auto_executed
- failed

### community_threads
Purpose: monitored conversations and drafted replies.
Fields:
- id
- product_id
- platform
- thread_url
- thread_title
- thread_author_handle
- relevance_score
- pain_signal_score
- audience_fit_score
- recency_score
- reply_draft
- promotional_score
- status
- posted_at
- created_at

Recommended `community_threads.status`:
- observed
- drafted
- pending_review
- approved
- posted
- skipped
- blocked
- failed

### outreach_contacts
Purpose: identified outreach prospects and contact lifecycle.
Fields:
- id
- product_id
- name
- email
- publication
- url
- score
- status
- last_contact_at
- provenance
- created_at
- updated_at

Recommended `outreach_contacts.status`:
- identified
- drafted
- pending_review
- sent
- opened
- replied
- converted
- suppressed
- failed

### directory_submissions
Purpose: status of each product's listing package per directory.
Fields:
- id
- product_id
- directory_id
- status
- submitted_at
- live_url
- notes
- created_at
- updated_at

Recommended `directory_submissions.status`:
- pending
- submitted
- live
- rejected
- skipped
- failed

### directories
Purpose: curated directory catalog.
Fields:
- id
- name
- url
- categories
- submission_method
- avg_da
- avg_traffic_tier
- review_time_days
- free_tier_available
- paid_tier_price
- active

### external_connections
Purpose: encrypted credentials and OAuth connections.
Fields:
- id
- user_id
- provider
- credentials_encrypted
- scopes
- status
- created_at
- updated_at

### automation_preferences
Purpose: product-scoped trust-level and review-window settings for automation channels.
Fields:
- id
- product_id
- channel: content | community | directories | outreach
- trust_level: 1 | 2 | 3
- daily_auto_action_limit
- review_window_hours
- created_at
- updated_at

Rules:
- preferences belong to a product and must be tenant-checked through product ownership
- trust levels are hints for server-side eligibility checks, not client authority
- low-confidence or high-risk outputs remain review-gated regardless of trust level

### keyword_rank_snapshots
Purpose: time-series keyword performance.
Fields:
- id
- product_id
- keyword
- rank_position
- source
- provenance
- recorded_at

### traffic_snapshots
Purpose: time-series traffic summaries.
Fields:
- id
- product_id
- source_type
- visits
- conversions
- provenance
- recorded_at

### weekly_briefs
Purpose: generated weekly digest content.
Fields:
- id
- product_id
- week_start
- summary_md
- recommendations
- sent_at
- created_at

## Cross-cutting rules
- all generated artifacts should store provenance metadata
- all execution-relevant entities should store timestamps and status transitions
- low-confidence generated items should be review-gated
- any item eligible for auto-execution still needs an audit trail
