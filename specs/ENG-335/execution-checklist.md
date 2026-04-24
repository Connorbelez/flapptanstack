# Execution Checklist: ENG-335 - Velocity package: add operator workflow integration and end-to-end coverage

## Requirements From Linear
- [x] Use the shared mock/backend harness from ENG-337 instead of bespoke browser-only fixtures.
- [x] Cover successful progression from package board to workspace to final review to activation.
  - Covered by `e2e/velocity/operator-workflow.spec.ts`; passed with `bunx playwright test e2e/velocity --project=velocity`.
- [x] Cover negative flows for unsupported frequency, missing PAD, incomplete bank/remediation data, stale reviewed hashes, activation failure remediation, and post-live drift visibility.
  - Covered by `e2e/velocity/remediation.spec.ts`; passed with `bunx playwright test e2e/velocity --project=velocity`.
- [x] Keep UI assertions tied to real backend payloads instead of restating business rules in the test layer.
- [x] Include integration coverage for document upload/link and `Sync now` where those flows are part of the operator journey.
  - The happy-path browser flow uploads PAD evidence through the UI, clicks `Sync now`, and asserts refreshed Velocity-owned data.

## Definition Of Done From Linear
- [x] Velocity operator workflow route/component coverage exists for board, workspace, review, remediation, and activation-state surfaces.
- [x] Playwright coverage exercises the core success and failure journeys against the shared harness.
- [x] The browser suite relies on the same backend scenario/harness contracts as ENG-337.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Route/component tests added for board, workspace/remediation, final review, and activation-state rendering.
- [x] Playwright tests added for happy path, blocker/remediation paths, stale review, activation failure remediation, and post-live drift visibility.
- [x] Backend/unit tests only added if implementation exposes a missing reusable harness or payload contract.
  - No production backend contract changed; a test-only Convex helper was added for e2e activation-failure state.
- [x] Storybook is not expected unless new reusable UI components are introduced; record justification if none are added.
  - No reusable UI components were introduced.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] `bunx convex codegen` passed.
- [x] Targeted route/component tests passed.
- [x] Relevant Velocity Playwright specs passed or blocker recorded.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
