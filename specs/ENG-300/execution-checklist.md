# Execution Checklist: ENG-300 - Broker portal runtime pricing productionization

## Requirements From Linear
- [x] Formalize portal pricing around the existing `portalPricingPolicies` seam and make the contract real in runtime code.
- [x] Fail closed for published portals with missing or invalid pricing at the root portal boundary.
- [x] Return backend-owned portal `availability` from host resolution, including a generic public misconfiguration state.
- [x] Thread portal-aware pricing into real listing detail and published-list query paths without mutating canonical listing data.
- [x] Add a temporary `/admin/settings` control that applies one broker-global portal adjustment across broker portals.
- [x] Persist a real `0%` default policy and keep the FairLend app portal pinned to `0%` outside broker-global updates.

## Definition Of Done From Linear
- [x] Portal pricing helpers are no longer test-only; runtime portal reads and listing reads consume them directly.
- [x] Published portals with broken pricing resolve to a blocked public root state instead of leaking child content.
- [x] Broker portal pricing can be viewed and updated from `/admin/settings`.
- [x] Broker portal backfill and FairLend portal bootstrap materialize selected active pricing rows deterministically.
- [ ] `bun run test -- ...`, `bun check`, `bun typecheck`, and `bunx convex codegen` pass for the widened ENG-300 scope.
  - Targeted Vitest coverage, `bun typecheck`, and `CONVEX_DEPLOYMENT=dev:impartial-sturgeon-498 bunx convex codegen` are green.
  - `bun check` still fails on pre-existing Biome complexity violations in unrelated files outside the ENG-300 diff. Scoped Biome over the ENG-300 files passes cleanly.

## Plan-Derived Contract Checks
- [x] The public root portal contract exposes only a generic `"misconfigured"` state rather than raw pricing failure reasons.
- [x] The FairLend app portal stays on the same runtime contract as broker portals, but its persisted selected policy remains `0%`.
- [x] Portal pricing remains a read-time projection over canonical listing inventory.
- [x] Only `interestRate` and `monthlyPayment` are projected through portal pricing in v1; principal, lien position, LTV, and other structural fields remain canonical.
- [x] The broker-global admin control is a control-plane setting that fans out to per-portal runtime policy rows instead of becoming a separate runtime read source.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Portal pricing tests cover malformed selected rows, malformed stored rows with no selected pointer, and a persisted `0%` no-op projection case.
- [x] Registry/backfill tests prove FairLend bootstrap and broker portal backfill both produce selected active policies.
- [x] Listing query tests cover `getListingWithAvailability` and `listPublishedListings` both with and without `portalId`.
- [x] Root portal context tests prove misconfigured published portals are blocked before child content renders.
- [x] Admin settings tests cover default boot, non-zero broker-global updates, idempotent repeat saves, and the pricing card submit/validation flow.

## Final Validation
- [x] All requirements are satisfied
- [ ] All definition-of-done items are satisfied
- [ ] Required quality gates passed
- [x] Test coverage expectations were met
- [x] Final `$linear-pr-spec-audit` blockers were resolved in the widened runtime scope
