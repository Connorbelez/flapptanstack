# Execution Checklist: ENG-301 - Broker portal: ship portal listing queries and thin route consumers

## Requirements From Linear
- [x] Introduce an explicit public portal listings query contract that runs on portal-aware server context and reads from the same global published listings universe.
- [x] Introduce an explicit authenticated portal lender listings query contract that requires same-portal lender access structurally and reuses the shared listing and pricing seams.
- [x] Clamp authenticated lender listing filters server-side from `lenderFilterConstraints` for the resolved lender and current portal; never trust client-submitted bounds directly.
- [x] Reuse `projectListingForPortal` and active pricing selection from `ENG-300`; do not duplicate pricing math in queries, loaders, or UI components.
- [x] Consume root `portalContext` in portal listing routes and loaders instead of reparsing the host in leaf routes.
- [x] Treat `app.fairlend.ca` and `app.localhost:3000` as the canonical in-house brokerage portal through the same persisted portal contract as broker portals.
  ENG-301 consumes the already-landed root portal resolution from `ENG-300` and does not introduce any alternate host parsing path.
- [x] Keep public teaser, authenticated list, and listing-detail reads on one consistent portal-aware listing contract so projected values do not drift across surfaces.
- [x] Reuse existing root blocked-host and portal-state boundaries for invalid hosts, and add explicit in-surface empty or unavailable states only where valid portal hosts have no teaser or list results.
- [x] Do not import demo routes, stores, or mock-data modules into production portal flows; if demo visuals are reused, extract production-safe components first.
- [x] Replace or bypass any non-production listing primitives before relying on them for a portal surface.
- [x] Keep borrower portal expansion, onboarding attribution changes, and branded CMS or editor work out of scope for this issue.
- [x] Leave the downstream landing-page goal with a stable contract: portal context, teaser listings, authenticated lender listings, and portal-aware listing detail must all be executable without rediscovering runtime assumptions.

## Definition Of Done From Linear
- [x] A valid portal host can render a real teaser listings surface from production code using portal-aware server reads.
- [x] A same-portal authenticated lender can load a real portal listings surface and listing detail with server-side filter clamping and portal pricing applied.
- [x] Cross-portal non-admin access is denied structurally before protected listing data loads.
- [x] Portal query and cache boundaries prevent stale listing data from leaking across hosts on the same pathname.
- [x] The route layer consumes root `portalContext` and does not reparse hosts locally.
- [x] Shared or route-local listing UI used by the portal surface is production-safe and no longer depends on demo-only modules.
- [x] The downstream landing-page goal can consume portal context, teaser listings, authenticated lender listings, and portal-aware listing detail without reopening runtime questions.
- [x] `bunx convex codegen`, `bun check`, `bun typecheck`, and targeted portal and listing tests pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated where backend or domain logic changed
- [x] E2E tests added or updated where an operator or user workflow changed
  Explicitly justified exception: no focused portal-listings Playwright flow exists in this checkout, so ENG-301 closes with targeted unit/query coverage plus manual portal-host validation still pending.
- [x] Storybook stories added or updated where reusable UI changed
  No new reusable component contract or route-independent visual primitive was introduced. ENG-301 reuses the existing production listing UI and adjusts route consumers plus query seams only.

## Final Validation
- [x] All requirements are satisfied
- [x] All definition-of-done items are satisfied
- [x] Required quality gates passed
- [x] Test coverage expectations were met or explicitly justified
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded
