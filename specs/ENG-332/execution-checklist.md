# Execution Checklist: ENG-332 - Velocity package: ship workspace queries, enrichment, readiness, and document linking

## Requirements From Linear
- [x] Expose package board rows that distinguish current Velocity stage, FairLend action state, readiness, and exception visibility.
- [x] Expose package detail payloads that clearly separate Velocity-owned immutable fields from FairLend-owned mutable enrichment and remediation data.
- [x] Implement package-owned remediation fields for `loanType`, `lienPosition`, and the same family of other required canonical inputs if mapping review proves they cannot be derived safely.
- [x] Derive readiness into explicit blocker/warning DTOs instead of storing hand-edited staff status.
- [x] Require PAD evidence and supporting-file links to reference existing `documentAssets` rows by explicit package document roles.
- [x] Persist final-review confirmation against a reviewed snapshot/hash and invalidate activation readiness when the current normalized hash changes.
- [x] Expose exception resolution and package audit events for staff-owned edits, document linking, readiness recomputation, and review confirmation.
- [x] Prevent mutation paths from overwriting Velocity-owned core borrower/property/loan facts.
- [x] Shape query responses so `ENG-336` and `ENG-334` can render board/workspace/final-review UI without reassembling backend contracts locally.

## Definition Of Done From Linear
- [x] Board and detail query surfaces exist for Velocity packages.
- [x] FairLend-owned enrichment/remediation, document-link, review-confirmation, and exception-resolution mutations exist and recompute readiness.
- [x] Readiness blockers and warnings are explicit, typed, and safe for UI consumption.
- [x] Final-review hash invalidation works whenever synced Velocity core data changes.
- [x] Velocity-owned core facts remain immutable through this slice.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit/Convex tests added or updated for backend DTOs, readiness, mutations, audit events, document links, and review invalidation.
- [x] E2E tests are not applicable in this backend-only slice; downstream UI issues own operator workflow E2E.
- [x] Storybook stories are not applicable in this backend-only slice; no reusable UI is added here.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted Convex tests passed.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
