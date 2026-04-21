# Status: chunk-03-backfill-home-portal

- Result: complete
- Last updated: 2026-04-20 22:22:14 EDT

## Completed tasks
- T-050 implemented via `convex/portals/borrowerPortalAttribution.ts` and `convex/brokers/migrations.ts`, including deterministic onboarding/borrower backfills plus unresolved-id reporting.
- T-060 completed by cutting `convex/portals/homePortalAssignment.ts` over to prefer explicit borrower `portalId` with deterministic legacy-org fallback.

## Validation
- `bun run test -- convex/portals/__tests__/registry.test.ts`: passed

## Notes
- Reuse the existing portal backfill surface if possible so operators do not need a second migration entry point unless the reporting contract requires it.
- The status surface now reports both missing portal attribution counts and unresolved onboarding/borrower ids so operators can distinguish fixable rows from ambiguous legacy data.
