# Chunk Context: chunk-01-gates-engagements

## Goal
- Add shared engagement evidence and legal gate helpers that can be used by backend mutations/queries without duplicating logic.

## Relevant Plan Excerpts
- "`REPRESENTATION_CONFIRMED` requires active authorized access and signed/accepted engagement evidence for same deal/lawyer."
- "Manual_admin engagement evidence can satisfy the guard in non-production or explicitly approved operational flows, but must be auditable."

## Implementation Notes
- Existing `decideLegalCheckpoint` already blocks `REPRESENTATION_CONFIRMED` unless engagement status is `signed`.
- Add helpers to locate the selected lawyer profile/auth ID, current eligible verification, active lawyer access, and latest signed engagement for a deal/lawyer.
- Return structured gate results with stable non-sensitive reason codes suitable for UI and Convex errors.

## Existing Code Touchpoints
- `convex/legalRepresentation/verifications.ts`
- `convex/legalRepresentation/validators.ts`
- `convex/legalRepresentation/fixtures.ts`
- `convex/schema.ts`
- planned new files: `convex/legalRepresentation/engagements.ts`, `convex/legalRepresentation/gates.ts`

## GitNexus Findings
- `confirmRepresentation`: LOW risk, no upstream dependents detected.
- `requireActiveLawyerDeal`: LOW risk, one local file caller.
- `lawyerAccessPolicyForDeal`: LOW risk, one local file caller.
- `buildLawyerActionStates`: LOW risk, one direct test caller.
- `executeTransition`: CRITICAL; avoid editing central engine function.

## Validation
- `bun test convex/legalRepresentation/__tests__/contracts.test.ts`
- new/updated gate tests
