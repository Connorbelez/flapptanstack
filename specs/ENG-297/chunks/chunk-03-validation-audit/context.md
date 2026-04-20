# Chunk Context: chunk-03-validation-audit

## Goal
- Prove the portal registry and root-resolution contract with focused tests, required repo quality gates, the final spec audit, and final scope reconciliation.

## Relevant plan excerpts
- Validation commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted Vitest runs, `bun run test` when scope broadens, `bun run test:e2e` when root host resolution affects visible route behavior, and `coderabbit review --plain`.
- Acceptance criteria include `localhost:3000`, `app.localhost:3000`, a valid broker `*.localhost:3000`, and an unknown broker host resolving the correct context.
- Final close-out must run `$linear-pr-spec-audit` and `gitnexus_detect_changes` before the issue is claimed complete.

## Implementation notes
- Prefer targeted Vitest coverage for portal modules and route/root behavior first; add Playwright only if the current harness can exercise host-based route outcomes cleanly, otherwise record the justification explicitly.
- Include one route-module integration test that proves blocked hosts do not leave a loader-shaped side-effect path on `/` and that non-root blocked requests redirect before child loaders can run.
- Use the execution checklist as the source of truth when deciding whether an audit finding is fixed or must be recorded as a blocker.
- Final scope verification should include `git diff` alongside `gitnexus_detect_changes` in case the CLI under-reports dirty-worktree symbols.

## Existing code touchpoints
- `convex/portals/__tests__/registry.test.ts`
- `src/test/routes/portal-context.test.tsx`
- `src/test/routes/root-route-blocked-hosts.test.ts`
- Playwright host-resolution coverage if feasible in the current test harness
- `specs/ENG-297/audit.md`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted Vitest runs for portal schema and route coverage
- `bun run test`
- `bun run test:e2e`
- `coderabbit review --plain`
- `$linear-pr-spec-audit`
- `gitnexus_detect_changes`
