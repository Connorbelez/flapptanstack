# Chunk Context: chunk-03-backfill-home-portal

## Goal
- Implement deterministic borrower and onboarding portal attribution backfill, surface unresolved rows explicitly, and update borrower-derived home portal assignment to prefer explicit borrower attribution.

## Relevant plan excerpts
- "Backfill existing rows deterministically. Prefer existing onboarding portal attribution when present; otherwise map `borrowers.orgId -> portals.by_org`. Leave unresolved rows unset and report them instead of guessing."
- "Update home-portal derivation or sync helpers to prefer explicit borrower attribution where borrower data still participates in `users.homePortalId` assignment."

## Implementation notes
- `convex/brokers/migrations.ts` already owns portal registry and `homePortalId` backfills, so extending that module is the shortest path unless the new logic becomes too large and needs extraction.
- `resolveUserHomePortalId` currently prefers broker and lender portal ownership, then borrower `orgId`, then organization membership, then the FairLend app portal. Borrower resolution should switch from `orgId` to explicit `borrowers.portalId`, with the current `orgId` path retained only as a deterministic legacy fallback while unresolved rows still exist.
- Backfill reporting should be operator-visible and deterministic. If the repo has no existing report table, a structured result from the admin mutation is acceptable as long as unresolved rows are enumerated instead of guessed.

## Existing code touchpoints
- `convex/brokers/migrations.ts`
- `convex/portals/homePortalAssignment.ts:resolveUserHomePortalId`
- `convex/auth.ts`
- GitNexus impact: `resolveUserHomePortalId` = LOW; direct caller path is `convex/brokers/migrations.ts`.
- GitNexus impact: `runPortalRegistryBackfill` = LOW.

## Validation
- `bunx vitest run convex/portals/__tests__/registry.test.ts`
