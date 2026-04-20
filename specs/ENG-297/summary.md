# Summary: ENG-297 - Broker portal: establish portal registry and host-resolution context

- Source issue: https://linear.app/fairlend/issue/ENG-297/broker-portal-establish-portal-registry-and-host-resolution-context
- Primary plan: https://www.notion.so/348fc1b44024812a92b5ed1e4ff1a010
- Supporting docs:
  - https://www.notion.so/33ffc1b44024815fb1ddc83c4d4195f9
  - https://www.notion.so/33ffc1b4402481f3b1f5d84c9cf98b0b
  - https://www.notion.so/33ffc1b4402480948e5ef7950f3095d4

## Scope
- Add the persisted portal contract in Convex: `users.homePortalId`, `portals`, and thin typed portal attachment tables for landing pages and pricing policies.
- Add backend portal validators, registry lookups, and tracked FairLend seed/backfill flows that reuse the existing broker/org data model instead of redesigning onboarding.
- Resolve a serializable root `PortalContext` from a trusted request-host seam before child loaders run, including fail-closed handling for marketing, admin, reserved, unknown, suspended, and unpublished hosts.
- Expose a stable portal cache-key helper and a shared root boundary surface so downstream loaders and UI do not re-parse host state.
- Add focused backend, route, and host-resolution validation coverage, then run the required quality gates and spec audit.

## Constraints
- Preserve WorkOS AuthKit as the source of truth and keep the current SSR auth token wiring in `src/routes/__root.tsx`.
- Keep exported Convex functions on fluent-convex builders with explicit `.public()` or `.internal()` visibility.
- Treat `app.fairlend.ca` and `app.localhost:3000` as real FairLend portal hosts backed by persisted data, not as hardcoded fallback behavior.
- Standardize local and E2E hosts on `localhost:3000`, `app.localhost:3000`, and `<portal>.localhost:3000`; do not add `127.0.0.1` support.
- Fail closed for unknown, reserved, unpublished, and suspended portal hosts at the root boundary; do not silently fall back to marketing.
- Keep this slice out of callback restoration, portal membership middleware, pricing-policy realization beyond placeholder seams, and landing-page CMS/editor work.
- Mark `portalLandingPages` and `portalPricingPolicies` as placeholder attachment points owned downstream by ENG-300 and the landing-page goal.

## Open questions
- none
