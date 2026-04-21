# Execution Checklist: ENG-310 - Lender portfolio: materialize historical snapshots and CSV export contracts

## Requirements From Linear
- [x] `portfolioSnapshots` is turned into a real materialized seam with deterministic identity by lender, date, and snapshot type.
- [x] Monthly and year-end snapshots are generated.
- [x] Snapshot reruns are idempotent.
- [x] Snapshot boundaries use the repo's strict UTC-safe `YYYY-MM-DD` business-date convention.
- [x] Historical chart inputs are published for cockpit consumers without route-local recomputation.
- [x] A server-generated CSV export result is published with `filename`, `csv`, and availability metadata for tax-software workflows.
- [x] Current-year or live fallback is explicit when a completed-period snapshot is not available.
- [x] All export logic remains server-side.
- [x] The contract does not label the output as a PDF, T5, or official tax document.

## Definition Of Done From Linear
- [x] Snapshot materialization exists and is deterministic.
- [x] Cockpit-consumable historical outputs exist.
- [x] The CSV export contract is server-generated and stable enough for `ENG-313` to consume directly.
- [x] Current-period fallback is explicit and test-covered.
- [x] No PDF or T5 implication remains in the contract.
- [x] Repo validation commands pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests are added under `convex/portfolio/__tests__/snapshots.test.ts` and `convex/portfolio/__tests__/export.test.ts` for reruns, UTC-safe cutoffs, current-period fallback, availability reasons, and stable CSV rows.
- [x] Existing portfolio query coverage is rerun or extended if ENG-310 changes source-of-truth metadata or public portfolio query contracts.
- [x] E2E coverage is evaluated and explicitly recorded as not required unless this backend slice expands into route or component ownership.
Not required: ENG-310 is a backend producer slice and does not own route or component behavior.
- [x] Storybook coverage is evaluated and explicitly recorded as not required unless this issue expands into reusable UI ownership.
Not required: ENG-310 does not introduce or change reusable UI components.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
