# Chunk Context: chunk-02-borrower-write-paths

## Goal
- Persist `borrowers.portalId` everywhere borrower rows are created or provisioned, with special focus on canonical origination borrower provisioning and seed/direct-insert helpers.

## Relevant plan excerpts
- "Capture `borrowers.portalId` everywhere a borrower row is created or provisioned, including admin origination and seed or helper paths that define canonical borrower creation behavior."
- "Update seeds, fixtures, and direct test inserts so the explicit attribution schema is exercised consistently."

## Implementation notes
- `ensureCanonicalBorrowerForOrigination` is the canonical borrower creation seam for admin origination. It currently keys uniqueness by `orgId`; this issue should preserve fail-closed behavior while adding explicit portal attribution.
- Admin origination entry points (`commit.ts`, `collections.ts`) currently pass org context, not portal context. Use the existing deterministic `orgId -> portals.by_org` mapping where a portal id is required at write time and explicit portal attribution is not yet present on the input.
- Review seed and test helpers for direct `ctx.db.insert("borrowers", ...)` calls so the new schema contract is consistently exercised.

## Existing code touchpoints
- `convex/borrowers/resolveOrProvisionForOrigination.ts:ensureCanonicalBorrowerForOrigination`
- `convex/admin/origination/commit.ts`
- `convex/admin/origination/collections.ts`
- `convex/seed/seedBorrower.ts`
- `convex/seed/seedHelpers.ts`
- `src/test/convex/admin/origination/commit.test.ts`
- GitNexus impact: `ensureCanonicalBorrowerForOrigination` = LOW; direct caller `convex/admin/origination/collections.ts`, imported by `convex/admin/origination/commit.ts`.

## Validation
- `bunx vitest run src/test/convex/admin/origination/commit.test.ts src/test/convex/seed/seedAll.test.ts`
