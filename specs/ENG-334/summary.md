# Summary: ENG-334 - Velocity package: deliver final review and activation UI wiring

- Source issue: https://linear.app/fairlend/issue/ENG-334/velocity-package-deliver-final-review-and-activation-ui-wiring
- Primary plan: https://www.notion.so/34bfc1b4402481abb9edcbe7302780f8
- Supporting docs:
  - https://www.notion.so/34bfc1b4402481e1a669db246c6a5869
  - https://www.notion.so/34bfc1b4402481038512d36fe9d3b2a2

## Scope
- Add the Velocity final review screen inside the existing admin Velocity workspace flow.
- Render the backend-derived activation preview data, reviewed snapshot provenance, blockers, warnings, and drift state.
- Wire final review confirmation, activate, and retry affordances to existing backend contracts.
- Surface failed activation attempt state and remediation context to operators.
- Add focused tests for rendering, disabled states, stale review data, and remediation/retry presentation.

## Constraints
- Do not implement readiness, review, or activation rules in React; use `workspace.readiness`, `workspace.finalReview`, snapshots, activation attempts, and backend action outcomes.
- Use existing admin route protection for `/admin/velocity*`; `src/lib/auth.ts` already covers `/admin/velocity` and descendants.
- Activation preview must use the same activation mapper output shape consumed by `activateMortgageAggregate`.
- Retry uses the existing `activateVelocityPackage` action with the reviewed snapshot because the backend idempotently resumes/reuses failed activation artifacts.
- GitNexus impact was run before edits, but symbol/file targets were not resolved by the index. Direct reference fallback shows affected callers in `src/routes/admin/$entitytype.$recordid.tsx`, `src/components/admin/velocity/types.ts`, `convex/velocity/review.ts`, and Velocity backend tests.

## Open questions
- None blocking. Storybook coverage is not planned because the added UI is route/page-specific and repo Velocity UI tests use Vitest + RTL.
