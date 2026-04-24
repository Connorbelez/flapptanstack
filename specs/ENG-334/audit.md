# Spec Audit: ENG-334 - Velocity package: deliver final review and activation UI wiring

- Audit skill: `$linear-pr-spec-audit`
- Review target: current local branch/worktree diff for ENG-334
- Last run: 2026-04-24T18:21:59Z
- Verdict: ready

## Findings
- None. No material gaps against the Linear issue definition of done or linked Notion implementation plan were found in the local diff.

## Unresolved items
- None.

## Coverage Summary
- SATISFIED: 10
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0
- OUT_OF_SCOPE: 1

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | capability | Final review screen exists inside the Velocity admin workspace. | `src/routes/admin.velocity.$workspaceId.review.tsx`, `src/components/admin/velocity/VelocityFinalReviewPage.tsx`, `src/components/admin/velocity/VelocityWorkspacePage.tsx` | Route is linked from the existing workspace page. |
| SATISFIED | frontend | Render backend activation preview data coherently, including mortgage economics, borrower/property/bank/PAD context, Rotessa inputs, and provenance identifiers. | `VelocityFinalReviewPage.tsx` | Data is rendered from `getVelocityPackageWorkspace` detail payload and current/reviewed snapshot fields. |
| SATISFIED | backend contract | Expose latest activation attempt state required for remediation UI without leaking full bank details. | `convex/velocity/workspaces.ts`, `src/test/convex/velocity/workspaces.test.ts` | Detail DTO includes latest attempt metadata; test asserts account number remains redacted. |
| SATISFIED | action wiring | Confirm review is wired to backend review contract using the current normalized hash and source snapshot. | `VelocityFinalReviewPage.tsx`, `src/test/admin/velocity/final-review.test.tsx` | Test verifies exact mutation arguments. |
| SATISFIED | action wiring | Activate/retry is wired to backend activation contract using reviewed snapshot ID/hash, not local readiness rules. | `VelocityFinalReviewPage.tsx`, `VelocityActivationStatusPanel.tsx`, `final-review.test.tsx` | Retry and activate call the same backend activation action with final review provenance. |
| SATISFIED | gating | Disable activation/retry for backend blockers, stale review data, and backend-reported in-flight activation. | `VelocityFinalReviewPage.tsx`, `VelocityActivationStatusPanel.tsx`, `final-review.test.tsx` | Buttons derive from `workspace.readiness.canActivate`, reviewed hash drift, and latest attempt status. |
| SATISFIED | remediation | Render failed activation remediation state and retry affordance without fabricating local rules. | `VelocityActivationStatusPanel.tsx`, `final-review.test.tsx` | Shows failure code/message from backend attempt and gates retry through backend-derived activation state. |
| SATISFIED | drift/provenance | Show review drift and provenance identifiers clearly. | `VelocityFinalReviewPage.tsx`, `final-review.test.tsx` | UI compares final-review hash to current normalized hash and displays workspace, loan, snapshot, and hash identifiers. |
| SATISFIED | auth/routing | Use structural admin route protection and existing pending/error patterns. | `src/routes/admin.velocity.$workspaceId.review.tsx` | Route uses `guardRouteAccess("adminVelocityPackages")`, `AdminRouteErrorBoundary`, and `AdminPageSkeleton`. |
| SATISFIED | tests | Add focused tests for backend DTO, preview rendering, disabled states, stale review, failure remediation, and retry wiring. | `src/test/convex/velocity/workspaces.test.ts`, `src/test/admin/velocity/final-review.test.tsx` | Targeted suites passed. |
| OUT_OF_SCOPE | E2E/storybook | Do not add Storybook or Playwright coverage for this slice unless needed. | `specs/ENG-334/chunks/chunk-03-tests-validation/status.md` | This route-specific contract wiring is covered by backend and RTL tests; no existing Storybook pattern for Velocity admin pages. |

## Validation Evidence
- `bun check` passed; existing warning-level complexity/style findings remain outside this change set.
- `bunx convex codegen` passed.
- `bun typecheck` passed.
- `bun run test src/test/convex/velocity/workspaces.test.ts` passed: 8 tests.
- `bun run test src/test/admin/velocity/final-review.test.tsx` passed: 3 tests.
- Vitest printed a close-timeout note after the targeted test suites completed, but both commands exited with code 0.

## Open Questions
- None.
