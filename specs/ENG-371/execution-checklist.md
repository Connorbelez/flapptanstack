# Execution Checklist: ENG-371 - File Workspace: add E2E fixtures, full user journeys, and implementation docs

## Requirements From Linear
- [x] Add deterministic seed helpers for FairLend admin, broker manager, editor, viewer, unrelated user, public link visitor, active/suspended boxes, nested folder tree, clean/pending/rejected/released/deleted files, expired/revoked links.
- [x] Add authenticated E2E for box creation and workspace navigation.
- [x] Add authenticated upload workflow E2E showing pending scan quarantine and clean-file preview/download according to role/policy.
  - Lower-level coverage now proves authenticated read models expose pending/rejected quarantine states while bearer links hide blocked files.
- [x] Add manager participant management E2E covering invite, role change, removal, and denied viewer/editor management attempts.
- [x] Add public link view-only E2E proving no platform navigation, upload, comment write, participant list, security feed, trash, old versions, or settings access.
- [x] Add magic link expiry and revocation E2E with neutral inaccessible state.
- [x] Add file replacement E2E proving a new version is created and previous current remains visible until clean.
- [x] Add retention-blocked permanent deletion E2E proving blocked operation and visible error.
- [x] Add scan release audit E2E or integration test proving platform admin can release `scan_error` with reason and non-admin cannot.
- [x] Document how to run and inspect the File Workspace test fixture locally.

## Definition Of Done From Linear
- [x] E2E suites cover authenticated workspace, public/magic links, security, scan, retention, and versioning flows.
- [x] Fixture docs make local reproduction deterministic.
- [ ] All required validation commands pass.
  - Blocked: `bun check` fails for repo-wide pre-existing complexity diagnostics. E2E execution was skipped per user instruction on 2026-05-02.
- [x] Any production defects discovered by tests are fixed with focused changes and corresponding lower-level coverage.
- [x] The issue graph is ready for human product/security review.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit or Convex integration tests added for new test-only fixture helpers and any production defects found.
- [x] E2E tests added under `e2e/file-workspace`.
- [x] Storybook stories are not expected because this issue adds browser journeys and docs, not reusable UI components.

## Final Validation
- [x] All implementation requirements are satisfied in code.
- [ ] All definition-of-done validation items are satisfied.
- [x] `bunx convex codegen` passed.
- [ ] `bun check` passed.
  - Failed after in-scope Biome errors were fixed; remaining diagnostics are unrelated pre-existing complexity findings, first in `convex/admin/origination/collections.ts`.
- [x] `bun typecheck` passed.
- [x] `bun run test -- convex/fileWorkspace src/test/file-workspace src/test/routes` passed.
- [ ] `bun run test:e2e -- e2e/file-workspace` passed.
  - Skipped per user instruction on 2026-05-02.
- [ ] `bun run test` passed before declaring the whole File Workspace goal complete.
  - Failed on unrelated existing AMPS and blocked-host route tests.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
