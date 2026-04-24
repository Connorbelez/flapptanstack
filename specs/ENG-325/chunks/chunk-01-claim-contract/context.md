# Chunk Context: chunk-01-claim-contract

## Goal
- Add the backend claim-convergence contract that resolves safe claim matches onto existing canonical broker, portal, and home-portal records without silently provisioning a new broker.

## Relevant plan excerpts
- "Add a reusable claim-convergence helper that consumes verified claim inputs and returns deterministic reuse or fallback outcomes."
- "If no safe claim match exists, the helper routes the actor toward self-serve onboarding or manual review rather than silent provisioning."
- "If no production claim route exists yet, prefer an internal or test harness over speculative UI scope."

## Implementation notes
- Reuse `resolveOrProvisionBrokerForActivation` only after a safe existing broker candidate is found, preventing its provision branch from silently creating a claim-only broker.
- Reuse `ensureBrokerPortalForActivation` for optional portal activation when a safe match also supplies a requested slug.
- Reuse `syncUserHomePortalAssignmentByUserId` without edits because GitNexus reports HIGH risk for changes to that portal seam.
- Keep claim outcomes explicit: reused existing broker, continue self-serve onboarding, or manual review required.

## Existing code touchpoints
- `convex/brokers/resolveOrProvision.ts`: `resolveOrProvisionBrokerForActivation` impact LOW; one direct caller, `activateBrokerForApprovedApplication`.
- `convex/brokers/activation.ts`: `ensureBrokerPortalForActivation` impact LOW; already uses shared portal invariant helpers.
- `convex/portals/homePortalAssignment.ts`: `syncUserHomePortalAssignmentByUserId` impact HIGH; call only.
- `convex/auth/actorResolution.ts`: confirms current actor lookup only resolves auth-linked brokers and has no claim fallback.

## Validation
- `bun run test -- src/test/convex/brokers/claimConvergence.test.ts`
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
