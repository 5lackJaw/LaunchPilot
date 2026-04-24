# FOLLOW_UPS

Track non-blocking technical risks, dependency watch items, cleanup tasks, and implementation notes that should not stop the current slice but should be revisited.

This document is not for missing product decisions. Use `docs/OPEN_QUESTIONS.md` when product input is required.

Format:
- Date:
- Area:
- Item:
- Current implication:
- Follow-up trigger:
- Safe current behavior:

- Date: 2026-04-25
- Area: Dependency security
- Item: `npm audit --omit=dev` reports a moderate PostCSS advisory (`GHSA-qx2v-qp2m-jg93`) through Next.js 16.2.4's bundled `next/node_modules/postcss@8.4.31`.
- Current implication: Low practical risk for LaunchPilot because the app does not accept user-submitted CSS, run PostCSS on user input, or embed PostCSS-stringified user CSS into HTML `<style>` tags.
- Follow-up trigger: Re-check when upgrading Next.js, when Next publishes a release that bumps bundled PostCSS to `8.5.10+`, or before adding any feature that accepts custom CSS from users.
- Safe current behavior: Do not run `npm audit fix --force`, because npm currently suggests a breaking downgrade to `next@9.3.3`; keep Next.js 16 current and avoid user-controlled CSS processing.
