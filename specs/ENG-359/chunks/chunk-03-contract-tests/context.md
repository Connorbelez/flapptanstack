# Chunk Context: chunk-03-contract-tests

## Goal
- Prove the new contracts preserve existing behavior and cover downstream legal-representation decisions.

## Relevant plan excerpts
- Existing checkout selectedLawyer behavior must still accept current platform and manual guest snapshots.
- Tests must cover eligibility/currentness decisions and contract compatibility.
- Fixtures required for eligible platform lawyer, restricted LSO lawyer, new guest lawyer invite, returning guest lawyer, expired invitation, and signed engagement evidence.

## Implementation notes
- Extend `convex/checkout/__tests__/validators.test.ts` for selectedLawyer compatibility.
- Add focused tests under `convex/legalRepresentation/__tests__/`.
- Use `convex-test` where DB row behavior is tested; keep pure helper tests as plain Vitest.

## Existing code touchpoints
- `convex/checkout/__tests__/validators.test.ts`
- `convex/deals/__tests__/closeEvidence.test.ts` for evidence-row testing style.
- `convex/deals/__tests__/access.test.ts` for dealAccess preservation assertions if needed.

## Validation
- Run targeted checkout/legalRepresentation tests before broad suite.
