# Chunk Context: chunk-03-tests-validation-audit

## Goal
- Prove ENG-364 behavior with targeted tests, required quality gates, GitNexus scope detection, and final spec audit.

## Relevant plan excerpts
- "Tests cover success, denial, stale action, and race cases."
- "Run `bunx convex codegen`, `bun check`, `bun typecheck`, targeted legalRepresentation status/invitation tests, targeted dealAccess tests, targeted lender/admin route tests."
- "Before finalizing, invoke `$linear-pr-spec-audit` against the same issue and the current PR or branch diff."

## Implementation notes
- Backend tests should cover projection states, resend expiry policy, change-email revocation/reissue, replacement cleanup, and confirmed/verified denial.
- Route/component tests should assert lender/admin status labels and available controls.
- E2E may be recorded as not applicable if full guest email/link delivery is not available locally; route/component coverage still required.
- Storybook is only required if a reusable component/story surface is introduced.

## Existing code touchpoints
- `convex/legalRepresentation/__tests__/*`
- `convex/deals/__tests__/access.test.ts`
- `src/test/routes/*` or focused lender/admin component tests.

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- Targeted tests
- GitNexus change detection
- `$linear-pr-spec-audit`
