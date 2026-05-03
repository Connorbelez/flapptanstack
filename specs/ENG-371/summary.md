# Summary: ENG-371 - File Workspace: add E2E fixtures, full user journeys, and implementation docs

- Source issue: https://linear.app/fairlend/issue/ENG-371/file-workspace-add-e2e-fixtures-full-user-journeys-and-implementation
- Primary plan: https://www.notion.so/350fc1b4402481db8492f64e2311bf92
- Supporting docs:
  - https://www.notion.so/350fc1b4402480efa2f0c395b89fa1d6
  - ENG-370 dependency is still In Review in Linear, but this worktree already contains `/files`, `/files/$boxId`, and `/files/public/$token`.

## Scope
- Add deterministic File Workspace E2E fixture helpers without changing shared auth helpers.
- Add Playwright specs for authenticated workspace creation/navigation/upload/versioning, public and magic links, security denials, scan release, and retention-blocked deletion.
- Add a test-only Convex fixture API where browser tests need deterministic backend state.
- Add implementation documentation for local fixture setup, commands, screenshots, and debugging.
- Fix production defects only when the tests expose a concrete contract violation.

## Constraints
- Do not loosen assertions to paper over product defects.
- Do not add sleeps when route, query, visible label, or backend state can be awaited.
- Do not depend on external scanners, host binaries, paid APIs, or non-deterministic external services.
- Public and magic-link surfaces must remain view-only and unauthenticated.
- Shared Playwright auth helpers have MEDIUM GitNexus blast radius; keep changes additive and scoped to File Workspace files.
- ENG-371 is test hardening only. No schema redesign, scanner provider redesign, or UI restyling beyond focused defect fixes.

## Open questions
- none
