# Chunk Context: chunk-03-negative-remediation-flows

## Goal
- Add operator browser coverage for negative, remediation, retry, stale review, document, sync, and post-live drift flows.

## Relevant plan excerpts
- "Cover negative operator flows for unsupported frequency, missing PAD, incomplete bank/remediation data, stale reviewed hashes, activation failure remediation, and post-live drift visibility."
- "Include integration coverage for document upload/link and `Sync now` where those flows are part of the operator journey."

## Implementation notes
- Use ENG-337 named scenarios: `unsupported_payment_frequency`, `missing_pad`, `incomplete_bank_data`, `upstream_change_after_final_review`, `rotessa_schedule_failure`, `retry_after_remediation`, and `post_live_velocity_drift`.
- Assert visible backend blocker codes/messages and activation attempt state, not duplicated rule computations in tests.
- Prefer one focused remediation spec over many large fragile specs.

## Existing code touchpoints
- `e2e/helpers/velocity.ts`
- `e2e/velocity/remediation.spec.ts`
- `convex/velocity/mock.ts`
- `src/components/admin/velocity/VelocityWorkspacePage.tsx`
- `src/components/admin/velocity/VelocityFinalReviewPage.tsx`
- GitNexus impact analysis required before modifying existing helper or exported Velocity symbols.

## Validation
- Targeted Playwright spec for `e2e/velocity/remediation.spec.ts`.
