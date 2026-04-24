# Execution Checklist: ENG-337 - Velocity package: add mock Velocity harness and backend regression coverage

## Requirements From Linear
- [x] Add mock Velocity endpoints and scenario generation APIs that simulate Newton Velocity and hit the production ingestion path.
- [x] Support deterministic and bounded scenario variation for borrower count, province, principal, rate, term, amortization, and payment frequency inputs from the design doc.
- [x] Add patch and update support for upstream changes after review plus unsupported and missing-data scenarios.
- [x] Cover webhook idempotency, `linkApplicationId` identity rules, readiness gates, final-review invalidation, unsupported payment frequencies, all-or-nothing activation, retry semantics, and post-live drift handling.
- [x] Prove automatically that no live canonical mortgage exists unless the full provider/payment and canonical activation path succeeds.
- [x] Expose scenario helpers in a way `ENG-335` can reuse instead of rebuilding browser-side fake data.

## Definition Of Done From Linear
- [x] Mock Velocity endpoints exist and drive the real Velocity ingress path.
- [x] The named backend scenarios from the design doc are implemented.
- [x] Backend regression coverage automatically catches the no-live-mortgage-on-failure invariant.
- [x] Retry/remediation and drift behavior are enforced by automated tests, not manual spot checks.
- [x] A reusable scenario and harness contract exists for downstream UI and browser coverage.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for scenario generation, payload builders, and patch helpers.
- [x] Backend/Convex integration tests added or updated for real-ingress workflow scenarios.
- [x] E2E browser tests are not required because ENG-337 explicitly excludes operator UI route wiring and Playwright coverage.
- [x] Storybook stories are not required because ENG-337 does not introduce reusable UI components or screens.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted Velocity tests passed.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
