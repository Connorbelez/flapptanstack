# Chunk Context: chunk-01-schema-and-gt

## Goal
- Add the canonical `brokerOnboardingApplications` persistence boundary and register `brokerOnboardingApplication` in the existing GT stack without changing shared Transition Engine behavior.

## Relevant plan excerpts
- Add the canonical persistence boundary for `brokerOnboardingApplication`.
- Register the aggregate in the existing Governed Transitions stack with the narrow top-level lifecycle required by the issue.
- Keep the top-level lifecycle narrow: `draft`, `submitted`, `changes_requested`, `approved`, `rejected`, `activated`.
- Treat `approved` as application-approved and `activated` as downstream provisioning complete after `onboardingRequest.role_assigned` plus portal or home-portal side effects.

## Implementation notes
- Follow the `lenderOnboardings` table for resumability field shape, but do not reuse that entity or its looser status conventions.
- Add a separate review-entry table so append-only review history does not get mixed into the application row as editable notes.
- Extend entity typing, validators, table mapping, and reconciliation status lookup as part of the new governed entity registration.
- Keep wizard-step detail and verification checkpoints out of the top-level status enum.

## Existing code touchpoints
- `convex/schema.ts`
- `convex/engine/types.ts`
- `convex/engine/validators.ts`
- `convex/engine/machines/registry.ts`
- `convex/engine/machines/onboardingRequest.machine.ts` as the closest governed onboarding example
- `convex/engine/reconciliationAction.ts`
- GitNexus impact: `machineRegistry`, `entityTypeValidator`, and `ENTITY_TABLE_MAP` are LOW risk with no indexed upstream dependents in the current graph.
- GitNexus impact: `lookupStatus` is LOW risk and flows only through `lookupStatuses` inside `convex/engine/reconciliationAction.ts`.

## Validation
- `bunx convex codegen`
- targeted GT machine tests
- targeted aggregate persistence tests after the surface layer exists
