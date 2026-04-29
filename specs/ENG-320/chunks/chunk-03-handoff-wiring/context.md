# Chunk Context: chunk-03-handoff-wiring

## Goal
- Wire application approval into one downstream `onboardingRequest` and wire role-assignment completion into the activation seam.

## Relevant plan excerpts
- "The system creates or links the downstream `onboardingRequest` with broker intent, `portalId`, and provenance back to the source application."
- "Reuse the existing downstream provisioning seam by driving the current `onboardingRequest` transition and effect path rather than duplicating WorkOS org or membership provisioning logic."
- "The application is only marked `activated` after the downstream provisioning and portal-assignment work actually complete."

## Implementation notes
- `convex/onboarding/brokerApplication/internal.ts` already has manual `linkDownstreamOnboardingRequest`, `markDownstreamRoleAssigned`, and `markActivated` helpers. This chunk should preserve compatibility while adding automatic approved-application handoff.
- `convex/engine/effects/onboarding.ts::assignRole` is the canonical WorkOS provisioning effect; after it sends `ASSIGN_ROLE`, it can invoke broker activation if the request has a broker application link.
- `executeTransition` is high risk and should not be modified.

## Existing code touchpoints
- `convex/onboarding/brokerApplication/internal.ts`
- `convex/onboarding/internal.ts`
- `convex/engine/effects/onboarding.ts`
- `convex/test/moduleMaps.ts` and generated API files after codegen.

## Validation
- Focused broker application handoff tests.
- Existing onboarding request tests where approval/effect behavior is touched.
