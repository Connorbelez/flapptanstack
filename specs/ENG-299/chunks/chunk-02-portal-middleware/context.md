# Chunk Context: chunk-02-portal-middleware

## Goal
- Add the structural portal middleware that reloads the trusted portal record, rejects unavailable portals, enforces same-portal membership with explicit FairLend admin override, and resolves lender and borrower access against the current portal contract.

## Relevant plan excerpts
- Add a portal middleware stage that accepts a server-resolved portal identifier, reloads the canonical portal row, and rejects unknown, suspended, archived, draft, or unpublished portals before business handlers run.
- Add a portal access stage that allows non-admin viewers only when `viewer.homePortalId` matches the current portal id.
- Add a lender portal stage that resolves the lender from auth identity and verifies lender-to-broker alignment against the current portal.
- Add a borrower portal stage that resolves borrower or onboarding attribution against the current portal rather than generic org equality alone.

## Implementation notes
- The middleware should accept a trusted server-side portal identifier, not a client-provided slug or host string.
- Portal availability is stricter than the public host-resolution contract: this slice must fail closed for draft, suspended, archived, unpublished, or missing portals before protected business logic runs.
- Same-portal membership should use the persisted `users.homePortalId` contract for non-admin viewers.
- Borrower portal attribution likely needs to accept either a borrower whose `orgId` maps to the current portal or an onboarding context that points to the portal's broker relationship; ambiguous or missing attribution must fail closed.
- Lender portal attribution should be keyed off the lender's `brokerId` against the current portal's `brokerId`, not generic `viewer.orgId`.

## Existing code touchpoints
- `convex/portals/queries.ts`
- `convex/portals/validators.ts`
- `convex/portals/helpers.ts`
- `convex/brokers/migrations.ts`
- `convex/schema.ts`

## Validation
- Portal middleware integration tests prove fail-closed availability and same-portal membership behavior
- Middleware returns typed `ctx.portal` and actor-specific context objects without `any`
