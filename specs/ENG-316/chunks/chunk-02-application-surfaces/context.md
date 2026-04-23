# Chunk Context: chunk-02-application-surfaces

## Goal
- Add the server-owned broker-application queries, mutations, validators, and internal helpers needed for start, resume, read, submit, review-thread persistence, expiry, and downstream handoff linkage.

## Relevant plan excerpts
- Add server-owned start, resume, read, and submit surfaces for thin route consumers.
- Persist portal attribution, resumability metadata, verification snapshot linkage, reopened-field state, and append-only review-thread primitives.
- Add explicit linkage fields and internal helpers for the downstream `onboardingRequest` handoff and final `activated` semantics.
- The aggregate must consume the verification contracts from `ENG-315` rather than invent local snapshot or recommendation enums.

## Implementation notes
- Prefer typed validators and helper modules under `convex/onboarding/brokerApplication/`.
- Capture `portalId` from trusted active portal context at application creation time using the same portal-resolution assumptions as existing onboarding code.
- Resume reads must support lookup by authenticated user and verified email while enforcing explicit expiry behavior and 30-day resumability.
- Review-thread writes must stay append-only and typed as `reviewer_note`, `broker_note`, or `system_event`.
- The handoff seam should make downstream linkage and activation prerequisites explicit without replacing the existing `onboardingRequest` provisioning flow.

## Existing code touchpoints
- `convex/onboarding/mutations.ts`
- `convex/onboarding/queries.ts`
- `convex/onboarding/internal.ts`
- `convex/engine/effects/onboarding.ts`
- `convex/portals/homePortalAssignment.ts`
- `shared/brokerOnboarding/contracts.ts`
- `convex/onboarding/verification/interface.ts`
- GitNexus impact: `requestRole` is LOW risk with no indexed upstream dependents in the current graph; it remains a reference seam for portal attribution and downstream onboarding-request creation patterns.

## Validation
- targeted broker-application aggregate tests
- targeted handoff-linkage tests
- `bunx convex codegen`
