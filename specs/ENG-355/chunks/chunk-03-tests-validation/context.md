# Chunk Context: chunk-03-tests-validation

## Goal
- Ensure MIC public root sign-in returns to `/portal`, then run the required quality gates and audit.

## Relevant plan excerpts
- Public root on MIC host is accessible signed out.
- Sign-in CTA from MIC public root sends users back to `/portal` on the same MIC host.
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted route/auth tests.
- Full WorkOS E2E is deferred to ENG-358.

## Implementation notes
- `src/routes/index.tsx` currently points unauthenticated portal users at `/sign-in?redirect=/listings`.
- The MIC portal can be detected via `portalContext.portal.portalType === "mic"`.
- Keep non-MIC portal root CTA behavior stable unless tests/spec require otherwise.

## Existing code touchpoints
- `src/routes/index.tsx`: adjust unauthenticated MIC CTA.
- `src/test/routes/portal-home-route.test.tsx`: add MIC CTA test.
- `specs/ENG-355/audit.md`: persist final `$linear-pr-spec-audit` verdict.
- GitNexus impact:
  - `HomeContent`: LOW, no indexed upstream dependents.

## Validation
- `bun test src/test/routes/portal-home-route.test.tsx src/test/routes/route-host-policy.test.ts src/test/auth/route-guards.test.ts`
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `$linear-pr-spec-audit`
- `python3 scripts/validate_execution_artifacts.py ENG-355 --repo-root "/Users/connor/.codex/worktrees/5d29/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
