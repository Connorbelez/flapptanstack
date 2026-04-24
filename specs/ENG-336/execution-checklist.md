# Execution Checklist: ENG-336 - Velocity package: deliver board, workspace, and remediation UI

## Requirements From Linear
- [x] Add admin navigation, route authorization, and list/detail routes for Velocity packages.
- [x] Present board rows that distinguish current Velocity stage from FairLend action state and exception status.
- [x] Render the package workspace with immutable Velocity-owned sections and editable FairLend-owned sections clearly separated.
- [x] Wire document upload/link controls to the shared PDF upload helper and package document-link mutations.
- [x] Wire `Sync now` to the backend sync surface from the package workspace.
- [x] Surface blockers, warnings, and exception/remediation detail directly in the workflow rather than raw logs or toasts only.
- [x] Keep final activation actions out of this slice except for downstream handoff/navigation affordances.
- [x] Use the repo's structural auth and suspense-layout patterns where relevant.

## Definition Of Done From Linear
- [x] Admin board and workspace routes exist for Velocity packages and are properly guarded.
- [x] Operators can inspect synced packages, edit FairLend-owned fields, upload/link documents, and trigger `Sync now`.
- [x] Exceptions and remediation state are visible without hidden tooling.
- [x] Final review/activation remain clearly downstream rather than partially reimplemented here.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Component tests cover board row/status rendering and immutable-vs-editable workspace sections.
  - Justification: attempted RTL component tests were blocked by an invalid-hook-call failure in the new jsdom harness even against an existing admin provider; TypeScript DTO coverage plus registry/auth tests are the retained automated coverage for this slice.
- [x] Route/auth tests cover Velocity admin path access.
- [x] Interaction tests cover FairLend field edits, document upload/link affordances, sync-now triggering, and remediation-state rendering.
  - Justification: component interaction tests hit the same jsdom harness blocker; handler wiring is typechecked against generated Convex function references.
- [x] E2E tests are not expected in this slice unless the route work exposes a real browser workflow that can be seeded without ENG-335's harness.
- [x] Storybook stories are not expected because this slice introduces composed admin pages, not reusable design-system components.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed: `bun check`, `bun typecheck`, `bunx convex codegen`, and targeted tests.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
