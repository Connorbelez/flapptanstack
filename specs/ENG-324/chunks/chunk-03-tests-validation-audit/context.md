# Chunk Context: chunk-03-tests-validation-audit

## Goal
- Add focused test coverage, run required repo validation commands, and perform the final spec-compliance audit.

## Relevant plan excerpts
- "Add targeted tests for permission enforcement, queue filtering, dossier projections, append-only thread writes, request-changes payload validation, broker-note ingestion, and approval-vs-activation visibility."
- "Validation: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests."
- "Before finalizing, invoke `$linear-pr-spec-audit` against the same issue and the current PR or branch diff."

## Implementation notes
- Prefer convex-test coverage for backend queues, dossier projections, and mutations.
- Use React Testing Library/Vitest for the admin workspace route/components.
- E2E and Storybook are probably not required because this issue can be validated with backend and route/component tests; document final rationale after implementation.
- Do not claim completion until `specs/ENG-324/audit.md` has a real audit verdict and final artifact validation passes.

## Existing code touchpoints
- `src/test/convex/onboarding/brokerApplicationTestHelpers.ts`
- `src/test/convex/onboarding/brokerApplication.aggregate.test.ts`
- `src/test/convex/onboarding/brokerApplication.handoff.test.ts`
- `src/test/routes/*`
- `scripts` from `linear-implement-v2` skill for artifact validation.

## Validation
- `bun run test -- src/test/convex/onboarding/brokerReviewQueue.test.ts src/test/convex/onboarding/brokerReviewActions.test.ts src/test/routes/admin/brokerOnboardingReview.test.tsx`
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `$linear-pr-spec-audit ENG-324`
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-324 --repo-root "/Users/connor/.codex/worktrees/eaa4/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
