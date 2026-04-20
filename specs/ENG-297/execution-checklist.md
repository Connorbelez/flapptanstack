# Execution Checklist: ENG-297 - Broker portal: establish portal registry and host-resolution context

## Requirements From Linear
- [x] Add a canonical persisted `portals` registry that resolves both FairLend and broker portals from production and local host fields rather than ad hoc route parsing.
- [x] Add `users.homePortalId` as the canonical non-admin post-auth portal-routing field.
- [x] Represent the FairLend in-house portal as a real portal row backing `app.fairlend.ca` and `app.localhost:3000`.
- [x] Model broker portal ownership structurally through `brokerId` and `orgId` on the portal row without redesigning broker onboarding flows.
- [x] Resolve a serializable root `PortalContext` before any child route loader reads tenant-sensitive data.
- [x] Classify `fairlend.ca`, `www.fairlend.ca`, and `localhost:3000` as marketing hosts.
- [x] Classify `app.fairlend.ca` and `app.localhost:3000` as the FairLend portal host, not a broker slug.
- [x] Reject reserved broker slugs such as `app`, `api`, `admin`, `staging`, and `www`.
- [x] Return explicit portal-not-found or portal-unavailable context for unknown, suspended, or unpublished portal hosts; never silently fall back to marketing.
- [x] Canonicalize hostnames to lowercase and implement one canonical-host rule for aliases and mixed-case requests.
- [x] Expose a stable, serializable portal cache key that downstream portal-sensitive loaders and query keys can reuse.
- [x] Provide a tracked seed/backfill path that can create the FairLend portal row and assign a sensible default `homePortalId` when no better assignment exists.
- [x] Keep this slice out of callback restoration, portal membership middleware, pricing math, and CMS/editor work.
- [x] Standardize local development and E2E hosts on `localhost:3000`, `app.localhost:3000`, and `<portal>.localhost:3000`; do not support `127.0.0.1` as a primary portal host.

## Definition Of Done From Linear
- [x] A persisted `portals` registry exists with unique lookup by production host and local host.
- [x] `users.homePortalId` exists and a documented migration runner can assign FairLend or broker defaults deterministically.
- [x] Root route context resolves marketing vs portal vs reserved vs unknown before child loaders execute.
- [x] `localhost:3000`, `app.localhost:3000`, and at least one broker `*.localhost:3000` host resolve the expected context.
- [x] Unknown, reserved, suspended, and unpublished hosts fail closed with explicit states.
- [x] Portal context is serializable and ready for downstream loader/query keys.
  The blessed contract is the minimal public pre-auth root context: canonical host identity, portal identity, availability, and cache scoping. Privileged portal metadata (`brokerId`, `orgId`, `landingPageId`, `pricingPolicyId`) is intentionally fetched later through authenticated seams when required.
- [x] The FairLend app host resolves through the same persisted registry contract as broker hosts.
- [ ] `bunx convex codegen`, `bun check`, and `bun typecheck` all pass.
  `bunx convex codegen` and `bun typecheck` passed. `bun check` remains blocked by pre-existing repo-wide complexity diagnostics in unrelated files.
- [x] Targeted route and Convex tests cover host parsing, registry lookup, seed/backfill, and root portal-context resolution.

## Plan-Derived Contract Checks
- [x] Preserve explicit non-portal `PortalContext` kinds for `marketing`, `admin`, `reserved`, and `unknown`.
- [x] Extract and normalize the trusted request host once in a shared root/server seam instead of reparsing hosts in leaf routes or auth redirect helpers.
- [x] Keep the root `PortalContext` as a minimal public pre-auth routing contract; do not expose `brokerId`, `orgId`, `landingPageId`, or `pricingPolicyId` from the public host resolver.
- [x] Keep placeholder `portalLandingPages` and `portalPricingPolicies` tables clearly marked as downstream-owned attachment points rather than fully realized product models.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated where backend, host-resolution, or root-loader logic changed
- [x] Route-level coverage proves blocked hosts keep the `/` child route inert and redirect non-root paths before child loaders run
- [x] E2E host-resolution coverage added or an explicit non-applicability rationale recorded
  Playwright coverage is explicitly not applicable for this slice because the existing harness does not model multi-host `localhost` routing; route and Convex integration tests cover the contract instead.
- [x] Storybook work explicitly marked not applicable because the repo does not define a Storybook workflow

## Final Validation
- [x] All requirements are satisfied
- [ ] All definition-of-done items are satisfied
  Remaining open item is the repo-level `bun check` gate outside the ENG-297 files.
- [x] Plan-derived contract checks are satisfied
- [ ] Required quality gates passed
  `bunx convex codegen`, `bun typecheck`, and focused Vitest coverage passed. `bun check` is still blocked by unrelated repo-wide complexity diagnostics.
- [x] Test coverage expectations were met or explicitly justified
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded
