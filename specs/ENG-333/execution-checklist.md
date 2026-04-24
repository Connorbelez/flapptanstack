# Execution Checklist: ENG-333 - Velocity package: implement reviewed activation orchestration and all-or-nothing handoff

## Requirements From Linear
- [x] Refuse activation unless the package is still at the reviewed hash and current Velocity status is exactly `Funded (6)`.
- [x] Consume package-owned remediation inputs from `ENG-332`; do not invent missing canonical inputs locally.
- [x] Preserve `workflowSourceKey` idempotency so duplicate activation attempts do not create duplicate canonical mortgages.
- [x] Create or reuse provider artifacts safely under the package activation idempotency key.
- [x] If provider activation fails, do not create a live canonical mortgage.
- [x] If provider artifacts already exist from a failed attempt, retry must reuse or compensate them rather than duplicating them silently.
- [x] Persist activation attempts with stage-level status, references, and failure metadata.
- [x] After activation, lock core borrower/property/loan/payment facts against later Velocity drift and record drift exceptions instead of patching canonical records.
- [x] Flow package identifiers, reviewed snapshot data, reviewer identity, activation attempt id, and created canonical record ids into the canonical mortgage audit journal.
- [x] Append activation-side package audit entries for final review consumption, activation attempts, provider artifact reuse/compensation, success/failure, and post-live drift.

## Definition Of Done From Linear
- [x] Package activation only succeeds when reviewed/funded/readiness invariants hold.
- [x] No live mortgage is created on provider/payment failure.
- [x] Failed attempts persist enough metadata for safe retry/remediation.
- [x] Successful activation links the package to canonical mortgage/provider records.
- [x] Activation-side package audit/provenance is explicit and flows into the canonical mortgage audit journal.
- [x] Post-live Velocity changes create drift exceptions rather than canonical data mutation.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Backend unit/Convex tests cover precondition refusal, reviewed-hash checks, readiness blockers, and remediation-field consumption.
- [x] Backend/Convex tests cover provider failure without live mortgage creation, successful activation, retry/provider reuse, duplicate activation suppression, package audit, mortgage audit provenance, and post-live drift.
- [x] E2E tests are not required in this backend-only slice; ENG-334 owns final review and activation UI wiring.
- [x] Storybook stories are not required because no reusable UI component or screen is introduced in this slice.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted Velocity activation tests passed.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
