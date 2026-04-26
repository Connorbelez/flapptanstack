# Chunk Context: chunk-04-validation-and-audit

## Goal
- Run the required repo gates, perform the final spec-compliance audit, and close or explicitly record every remaining gap.

## Relevant plan excerpts
- "Run `bunx convex codegen`, `bun check`, and `bun typecheck`."
- "Add targeted tests around provider selection, email-verification normalization, and any permission metadata or RBAC-doc synchronization touched by this contract freeze."
- "Treat the audit as a release gate, not a nice-to-have review."

## Implementation notes
- The final validation must include targeted ENG-315 tests plus the repo-required `bunx convex codegen`, `bun check`, and `bun typecheck` commands.
- The final audit should review the current branch diff against its real base unless a PR exists by that point.
- If repo-wide failures unrelated to ENG-315 block closeout, they must be recorded explicitly in `status.md`, `execution-checklist.md`, and `audit.md`.

## Existing code touchpoints
- `specs/ENG-315/audit.md` stores the final audit verdict and unresolved items.
- GitNexus closeout requires a detect-changes pass before wrap-up or commit.

## Validation
- `bun run test -- src/test/convex/onboarding/verification-contracts.test.ts src/test/convex/onboarding/workos-email-verification.test.ts src/test/auth/permissions/onboarding-permission-contract.test.ts`
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- final `$linear-pr-spec-audit`
