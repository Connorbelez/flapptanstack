# Summary: ENG-335 - Velocity package: add operator workflow integration and end-to-end coverage

- Source issue: https://linear.app/fairlend/issue/ENG-335/velocity-package-add-operator-workflow-integration-and-end-to-end
- Primary plan: https://www.notion.so/34bfc1b44024819086a2f82d41140987
- Supporting docs:
  - https://www.notion.so/34bfc1b4402481e1a669db246c6a5869
  - https://www.notion.so/34bfc1b4402481038512d36fe9d3b2a2
  - ENG-336: https://github.com/Connorbelez/tanstackTemplate/pull/507
  - ENG-334: https://github.com/Connorbelez/tanstackTemplate/pull/508
  - ENG-337 shared mock/backend harness contract

## Scope
- Add route/component integration coverage for Velocity package board, workspace, remediation, final review, and activation-state surfaces.
- Add Playwright operator coverage for board to workspace to final review to activation using the shared Velocity mock/backend harness.
- Cover negative operator flows for unsupported payment frequency, missing PAD, incomplete bank/remediation data, stale reviewed hashes, activation failure remediation, and post-live drift visibility.
- Reuse existing admin/e2e patterns, including `e2e/helpers/origination.ts`, route-level tests, and the ENG-337 mock Velocity scenario endpoints.

## Constraints
- Use the ENG-337 mock/backend harness; do not create browser-only fake payload rules.
- Keep assertions tied to backend payloads exposed by Convex queries/mutations or mock scenario metadata.
- Do not change production readiness, activation, or Velocity ingestion rules unless a test exposes a missing integration seam.
- Authenticated route tests must follow the repo's structural auth and suspense layout conventions.
- Required repo gates before completion: `bun check`, `bun typecheck`, `bunx convex codegen`, targeted tests, and relevant e2e suite.

## Open questions
- ENG-337 is still marked in progress in Linear, but the current worktree contains mock Velocity endpoints and regression tests. Implementation will proceed against the local shared harness and record blockers if an expected harness contract is absent.
