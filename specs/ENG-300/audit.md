# Spec Compliance Review

- Audit skill: `$linear-pr-spec-audit`
- Review target: `eng-297..working-tree` on top of `HEAD = c631ecca2a04570b0da69f080dda691ff8ddcf16`
- Last updated: `2026-04-21T00:09:40Z`

## Findings
- None remaining in the ENG-300 runtime rollout.

## Reviewed follow-ups
- Resolved: runtime pricing helpers are now wired into `resolvePortalByHost`, `getListingWithAvailability`, and `listPublishedListings`, so portal pricing is no longer test-only.
- Resolved: the published-portal `invalid-policy` branch is covered in `convex/portals/__tests__/pricing.test.ts`.
- Resolved: the stale audit-target drift was removed from the artifact set. This closeout now points at the current local runtime rollout on top of `c631ecca2`, not the earlier `HEAD^` snapshot.
- Resolved: the stale GitNexus note was downgraded from current-state language to historical context in the execution artifacts.
- Resolved: broker-global pricing changes now emit an audit log entry from `setBrokerPortalPricing`, including previous and new values plus fan-out counts.
- Verified non-blocker: the policy archival patch path in `ensurePortalSelectedPricingPolicy` remains direct by design because `portalPricingPolicies` are configuration rows, not a governed-transition entity with an existing Transition Engine integration in this slice.

## Verdict
- implementation_ready_with_repo_gate_blocker

## Coverage Summary
- SATISFIED: 11
- PARTIAL: 1
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | runtime root contract | Published portals fail closed at the root boundary when pricing is missing or invalid | `convex/portals/queries.ts`, `src/lib/portal/host-resolution.ts`, `src/components/portal/portal-state-boundary.tsx`, `src/test/routes/portal-context.test.tsx` | public contract exposes `"misconfigured"` without leaking backend failure reasons |
| SATISFIED | listing detail runtime | Portal identity reaches `getListingWithAvailability` and projects only portal-priced fields | `convex/listings/queries.ts`, `src/components/lender/listings/LenderListingDetailPage.tsx`, `convex/listings/__tests__/queries.test.ts`, `src/test/lender/listing-detail-page.test.tsx` | canonical listing behavior is unchanged when `portalId` is omitted |
| SATISFIED | list runtime | `listPublishedListings` accepts `portalId` and applies row-level portal pricing projection | `convex/listings/queries.ts`, `convex/listings/__tests__/queries.test.ts` | availability attachment behavior stays unchanged |
| SATISFIED | control plane | Broker-global pricing setting is persisted as a singleton with a real default `0%` | `convex/schema.ts`, `convex/portals/pricing.ts`, `src/test/convex/admin/settings/broker-portal-pricing.test.ts` | runtime still reads per-portal `portalPricingPolicies`, not the singleton directly |
| SATISFIED | synchronization | FairLend portal bootstrap, broker portal backfill, and portal registry repair all materialize selected active policies | `convex/brokers/migrations.ts`, `convex/portals/pricing.ts`, `convex/portals/__tests__/registry.test.ts` | FairLend app portal stays pinned to `0%` |
| SATISFIED | admin surface | `/admin/settings` exposes the broker-global pricing snapshot and save control | `convex/admin/settings/queries.ts`, `convex/admin/settings/mutations.ts`, `src/components/admin/settings/AdminSettingsPage.tsx`, `src/test/admin/admin-settings-page.test.tsx` | copy states that the value applies to all broker portals and excludes FairLend app |
| SATISFIED | auditability | Broker-global pricing changes are auditable | `convex/admin/settings/mutations.ts`, `src/test/convex/admin/settings/broker-portal-pricing.test.ts` | mutation logs previous value, new value, actor, and sync counts |
| SATISFIED | fail-closed math | Invalid-policy and persisted `0%` projection cases are covered | `convex/portals/__tests__/pricing.test.ts` | includes malformed stored rows with no selected pointer |
| SATISFIED | host resolution | Frontend no longer infers portal availability locally | `convex/portals/validators.ts`, `convex/portals/queries.ts`, `src/lib/portal/host-resolution.ts` | backend availability is source of truth |
| SATISFIED | review hygiene | Earlier audit findings were addressed directly in code and artifacts | `specs/ENG-300/*.md`, runtime/test files above | no remaining implementation gaps from the prior review set |
| PARTIAL | repo quality gates | Final verification includes targeted tests, `bun typecheck`, `bunx convex codegen`, scoped Biome, and `bun check` | local command evidence | `bun check` still fails on pre-existing unrelated Biome complexity diagnostics outside the ENG-300 diff |

## Validation Evidence
- `bun run test -- convex/portals/__tests__/pricing.test.ts convex/portals/__tests__/registry.test.ts convex/listings/__tests__/queries.test.ts src/test/routes/portal-context.test.tsx src/test/lender/listing-detail-page.test.tsx src/test/admin/admin-settings-page.test.tsx src/test/convex/admin/settings/broker-portal-pricing.test.ts`: passed (`43` tests across `7` files)
- `bun run test -- src/test/lender/listing-detail-page.test.tsx`: passed (`3` tests); Vitest reported a post-run close timeout after success
- `bun typecheck`: passed
- `CONVEX_DEPLOYMENT=dev:impartial-sturgeon-498 bunx convex codegen`: passed
- `bunx biome check <ENG-300 changed files>`: passed
- `bun check`: failed on unrelated repo-wide Biome complexity diagnostics outside the ENG-300 diff
- `coderabbit review --plain --type uncommitted --files <ENG-300 files>`: passed with no findings
