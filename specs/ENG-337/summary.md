# Summary: ENG-337 - Velocity package: add mock Velocity harness and backend regression coverage

- Source issue: https://linear.app/fairlend/issue/ENG-337/velocity-package-add-mock-velocity-harness-and-backend-regression
- Primary plan: https://www.notion.so/34bfc1b4402481b2b65fe4fdda49e894
- Supporting docs:
  - Velocity Package Integration Contract: https://www.notion.so/34bfc1b4402481e1a669db246c6a5869
  - Velocity Package Integration Design: https://www.notion.so/34bfc1b4402481038512d36fe9d3b2a2

## Scope
- Add a reusable mock Velocity harness that generates the named success/failure scenarios and stores mock deals without bypassing production ingestion semantics.
- Add development/test HTTP endpoints for scenario creation, mock webhook delivery, mock full-deal fetch/search, and mock deal patching.
- Exercise the real Velocity webhook/full-deal sync path from mock scenarios, including idempotency, linkApplicationId identity, readiness, final-review invalidation, unsupported mappings, activation failure, retry, and post-live drift.
- Add backend regression tests and reusable helpers for downstream ENG-335 UI/browser coverage.

## Constraints
- Mock scenarios must simulate Newton Velocity and enter through the production webhook/full-deal ingestion path.
- Do not create demo-only shortcuts that mutate package state directly or mask activation failures.
- Scenario variation must be bounded and deterministic enough to diagnose regressions.
- Boundary payloads should use `unknown` or typed records, not `any`.
- No live canonical mortgage may exist unless provider/customer, provider/schedule, and canonical activation all succeed.
- Unsupported Velocity payment frequencies and missing activation inputs must remain remediation blockers.
- This slice is backend/test focused; operator route wiring and Playwright browser coverage are out of scope.

## Open questions
- none
