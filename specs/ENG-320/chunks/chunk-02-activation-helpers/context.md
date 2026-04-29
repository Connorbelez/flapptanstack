# Chunk Context: chunk-02-activation-helpers

## Goal
- Implement the backend activation seam that canonicalizes broker identity, portal registration, home-portal sync, and activation outcome persistence.

## Relevant plan excerpts
- "Add a canonical broker resolve-or-provision helper that prefers strongest verified identifiers first, rejects ambiguous or cross-org matches, and preserves `_id` stability across retries."
- "Extract reusable broker-portal upsert helpers out of migration code and use shared portal contracts plus registry invariants to create or patch the canonical broker portal."
- "Synchronize `users.homePortalId` only through `convex/portals/homePortalAssignment.ts` after canonical broker and portal writes succeed."

## Implementation notes
- Borrower precedent: `convex/borrowers/resolveOrProvisionForOrigination.ts` resolves by stable identity, fails closed on cross-org conflicts, patches existing rows, and syncs home portal through shared helpers.
- Broker portal backfill logic currently lives in `convex/brokers/migrations.ts`; runtime code should use a shared helper rather than copying migration-only logic.
- Portal identity must use `normalizePortalSlug`, `isReservedPortalSlug`, `buildPortalHosts`, `assertPortalRegistryInvariants`, and pricing helpers.

## Existing code touchpoints
- Create `convex/brokers/resolveOrProvision.ts`.
- Create `convex/brokers/activation.ts`.
- Modify `convex/portals/helpers.ts` only if reusable broker portal defaults need to be exported.
- Modify `convex/brokers/migrations.ts` only if migration backfill can reuse the runtime helper safely.

## Validation
- Focused broker resolve/provision tests.
- Focused broker portal activation tests.
