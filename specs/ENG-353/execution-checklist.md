# Execution Checklist: ENG-353 - MIC portal: add public access request intake

## Requirements From Linear
- [x] Validate submitted email as an email-like string, trim whitespace, and store lowercase `normalizedEmail` for idempotency.
- [x] Require an active, published MIC portal; reject non-MIC, suspended, archived, draft, unpublished, or missing portal ids.
- [x] For an existing pending or approved request for the same portal and normalized email, return `{ ok: true, status: "received" }` without exposing the existing request id or status.
- [x] For a rejected prior request, allow a new `pending_review` request for the same email and portal.
- [x] Insert new requests with `status="pending_review"`, `provisioningState="not_started"`, and `requestedAt=Date.now()`.
- [x] Journal the creation event with `entityType="micInvestorAccessRequest"`, `eventType="CREATED"`, `previousState="none"`, and `newState="pending_review"`.
- [x] Return the same generic success response for create and reuse paths.
- [x] Do not require authentication for the public submission mutation.
- [x] Do not reuse `onboardingRequests` or authenticated onboarding role request logic for MIC public intake.
- [x] Keep exported Convex functions on fluent builders with explicit `.public()` or `.internal()`.

## Definition Of Done From Linear
- [x] A dedicated MIC access request entity exists with documented fields and indexes.
- [x] Public email-only request submission works for active MIC portals.
- [x] Duplicate behavior is idempotent and non-leaky.
- [x] Rejected emails can resubmit later.
- [x] Creation is audited and journaled.
- [x] Existing authenticated onboarding behavior is unchanged.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated where backend or domain logic changed.
- [x] E2E tests added or updated where an operator or user workflow changed.
  - Not expected for this backend-only public mutation slice; landing-page wiring belongs to ENG-357.
- [x] Storybook stories added or updated where reusable UI changed.
  - Not expected for this backend-only slice; no reusable UI is changed.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed.
  - `bunx convex codegen`, `bun check`, `bun typecheck`, targeted MIC tests, and onboarding regression passed. Full `bun run test` has an unrelated persistent AMPS E2E baseline failure recorded in `audit.md`.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
