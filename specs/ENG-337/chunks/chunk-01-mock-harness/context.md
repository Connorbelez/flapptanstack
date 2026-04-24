# Chunk Context: chunk-01-mock-harness

## Goal
- Add the typed reusable mock Velocity scenario layer: named scenarios, deterministic bounded randomization, full-deal payload builders, patch/update helpers, and downstream test exports.

## Relevant plan excerpts
- Mock system must simulate Velocity rather than bypass FairLend ingestion.
- Scenario request supports status, borrower count, province, principal, rate, term, amortization, payment frequency, missing/duplicate identity, upstream change, Rotessa failures, and unsupported enum controls.
- Required named scenarios: `early_status_package_created`, `progression_to_funded`, `missing_link_application_id`, `duplicate_link_application_id`, `unsupported_enum`, `unsupported_payment_frequency`, `missing_required_core_field`, `upstream_change_after_final_review`, `missing_pad`, `incomplete_bank_data`, `rotessa_customer_failure`, `rotessa_schedule_failure`, `retry_after_remediation`, `successful_all_or_nothing_activation`, `post_live_velocity_drift`.

## Implementation notes
- Use existing `VelocityDeal`, `VelocityWebhookPayload`, and mapping contracts from `convex/velocity/contracts.ts`.
- Keep randomization deterministic via a seed or stable counter so regression failures are reproducible.
- Patch helpers should support removals by field path without using `any`; use `unknown`, typed records, or specific Velocity DTO types.
- Scenario helpers should be importable from backend tests and reusable by ENG-335.

## Existing code touchpoints
- New expected file: `convex/velocity/mock.ts`.
- Existing contracts: `convex/velocity/contracts.ts`, `convex/velocity/constants.ts`.
- Existing tests duplicate local `makeDeal` helpers in `src/test/convex/velocity/*.test.ts`; this chunk should centralize equivalent reusable builders.
- GitNexus impact checks are tracked in `specs/ENG-337/status.md`.

## Validation
- Unit tests for scenario generation, named scenario defaults, bounded deterministic values, and patch/remove-field behavior.
