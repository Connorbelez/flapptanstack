# Chunk Context: chunk-03-handoff-tests-validation

## Goal
- Prove the new aggregate contract with focused tests, run the required repo gates, and close the issue with a spec-compliance audit.

## Relevant plan excerpts
- Add targeted tests for lifecycle registration, resumability, review-thread primitives, expiry behavior, and handoff linkage.
- `activated` is only legal after the linked `onboardingRequest` reaches `role_assigned` and the portal or home-portal side effects complete successfully.
- Run `bunx convex codegen`, `bun check`, and `bun typecheck`.
- Run `$linear-pr-spec-audit` and treat it as a release gate.

## Implementation notes
- Prefer focused Vitest coverage under `src/test/convex/onboarding/` mirroring the issue plan.
- If route or reusable UI scope never appears, explicitly record why E2E and Storybook are not applicable instead of silently skipping them.
- The audit outcome must be persisted in `specs/ENG-316/audit.md`, and unresolved missing or contradicted items must block final closeout.

## Existing code touchpoints
- `src/test/convex/onboarding/onboarding.test.ts`
- `src/test/convex/engine/transition.test.ts`
- `src/test/convex/onboarding/verification-contracts.test.ts`
- `specs/ENG-316/audit.md`
- `specs/ENG-316/execution-checklist.md`

## Validation
- `bun run test -- <broker onboarding test files>`
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `$linear-pr-spec-audit`
