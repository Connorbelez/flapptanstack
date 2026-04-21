# Tasks: ENG-300 - Broker portal runtime pricing productionization

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning And Blast Radius
- [x] T-001: Gather Linear and Notion context, confirm the widened runtime scope, and refresh the execution artifacts
- [x] T-002: Run GitNexus analyze plus pre-edit impact checks for `resolvePortalByHost`, listing queries, portal bootstrap/backfill seams, and the admin settings surface

## Phase 2: Runtime Pricing Control Plane
- [x] T-010: Add the broker-global pricing singleton table and helper layer with a persisted `0%` default
- [x] T-011: Add idempotent portal selected-policy synchronization and reuse it from FairLend portal bootstrap, broker portal backfill, and portal registry repair

## Phase 3: Root Fail-Closed Runtime
- [x] T-020: Extend portal validators and host-resolution contracts with backend-owned public `availability`, including `"misconfigured"`
- [x] T-021: Productionize fail-closed behavior in `resolvePortalByHost` for published portals with invalid pricing
- [x] T-022: Update the portal root UI boundary and route-context tests to block misconfigured published portals before child content renders

## Phase 4: Portal-Aware Listing Reads
- [x] T-030: Add optional `portalId` support to `getListingWithAvailability`
- [x] T-031: Add optional `portalId` support to `listPublishedListings`
- [x] T-032: Thread portal identity from the root route context into the live lender listing detail surface

## Phase 5: Admin Settings Surface
- [x] T-040: Extend admin settings queries with a broker portal pricing snapshot
- [x] T-041: Add `setBrokerPortalPricing` fan-out mutation and enforce FairLend app exclusion from broker-global updates
- [x] T-042: Add the temporary broker portal pricing card to `/admin/settings`

## Phase 6: Validation And Audit
- [x] T-900: Run targeted runtime, portal, listing, and admin settings tests for the widened ENG-300 scope
- [x] T-910: Run `bunx convex codegen`, `bun check`, and `bun typecheck`
- [x] T-920: Update `summary.md`, `execution-checklist.md`, `status.md`, and `audit.md` so they reflect the runtime rollout instead of the earlier helper-only interpretation

T-920 note: the stale GitNexus note is now historical context only. Current branch state wires runtime portal availability and listing projection directly, so the docs no longer describe runtime productionization as unresolved work.
