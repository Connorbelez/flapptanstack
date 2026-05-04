# Chunk Context: chunk-03-tests

## Goal
- Prove the public intake contract, duplicate behavior, rejected resubmission, portal fail-closed behavior, unauthenticated access, and audit rows.

## Relevant plan excerpts
- Tests must cover active MIC creation, duplicate pending/approved, rejected resubmit, non-MIC portal, inactive portal, missing portal, invalid email, and audit journal/log rows.
- E2E browser tests are deferred to landing-page wiring.

## Implementation notes
- Use `createConvexTestKit` from `src/test/convex/testKit.ts`.
- Use `micPortalFields` from `convex/portals/helpers.ts` for active MIC fixture.
- Query `auditJournal` by `entityType="micInvestorAccessRequest"`.
- Query audit log by resource type `micInvestorAccessRequests` if helper support is straightforward.

## Existing code touchpoints
- `src/test/convex/micInvestorAccessRequests/mutations.test.ts`: new.
- `src/test/convex/onboarding/onboarding.test.ts`: inspect as audit pattern; no edit planned unless regression requires it.

## Validation
- Targeted MIC test command.
- Onboarding test command.
