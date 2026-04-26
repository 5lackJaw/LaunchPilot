# OPEN_QUESTIONS

Record unresolved product or implementation questions here.

Format:
- Date:
- Area:
- Question:
- Safe temporary behavior chosen:
- Why product input is needed:

- Date: 2026-04-26
- Area: Pricing and plan limits
- Question: [UNSPECIFIED — REQUIRES PRODUCT DECISION] What are the final product count, monthly crawl, generated action, and execution limits for the free, launch, and growth plans?
- Safe temporary behavior chosen: Enforce conservative provisional limits in `PlanService`: free gets 1 product, 5 crawls, 20 generated actions, and 10 executions per month; launch gets 3 products, 30 crawls, 200 generated actions, and 100 executions per month; growth gets 10 products, 150 crawls, 1000 generated actions, and 500 executions per month.
- Why product input is needed: These limits directly affect pricing, packaging, onboarding friction, and upgrade prompts, so they should be finalized as a product/business decision before public launch.
