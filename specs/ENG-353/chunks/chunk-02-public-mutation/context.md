# Chunk Context: chunk-02-public-mutation

## Goal
- Implement the backend public intake mutation with non-leaky idempotency and creation audit writes.

## Relevant plan excerpts
- Public return shape: `{ ok: true, status: "received" }`.
- Existing pending/approved request for same `(portalId, normalizedEmail)` must return the generic success shape without exposing request id or status.
- Rejected prior request may create a new `pending_review` request.
- Creation journal fields: `entityType="micInvestorAccessRequest"`, `eventType="CREATED"`, `previousState="none"`, `newState="pending_review"`.

## Implementation notes
- Export through `convex.mutation().input(...).returns(...).handler(...).public()` without auth middleware.
- Use `resolveMicPortalConfig` to fail closed for non-MIC, inactive, unpublished, missing mapping, or missing portal ids.
- Query `by_portal_email_status` for `pending_review` and `approved`; rejected rows must not block creation.
- On actual insert, call existing `appendAuditJournalEntry` and `auditLog.log`; do not edit `appendAuditJournalEntry`.
- Use a system/public actor id such as `public:mic-access-request` and channel compatible with existing validators.

## Existing code touchpoints
- `convex/micInvestorAccessRequests/mutations.ts`: new.
- `convex/portals/micConfig.ts`: call existing `resolveMicPortalConfig`; no edit planned.
- `convex/engine/auditJournal.ts`: call-only; GitNexus CRITICAL if modified.
- `convex/auditLog.ts`: call-only.

## Validation
- Convex tests in chunk 03.
- Existing onboarding tests because this uses the same audit/journal infrastructure.
