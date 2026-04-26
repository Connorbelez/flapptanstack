# Chunk Context: chunk-01-admin-read-model

## Goal
- Deliver admin read APIs for MIC access request triage: list/filter defaults, detail payload, and audit/history visibility.

## Relevant plan excerpts
- "Admin list defaults to pending MIC requests and supports status, provisioning state, portal, and requested date filters."
- "Admin detail returns request fields, portal context, review metadata, provisioning metadata, and audit/history rows."
- "Non-admin users cannot list, approve, reject, or view histories."

## Implementation notes
- Add `convex/micInvestorAccessRequests/queries.ts` using `adminQuery.use(requirePermission(...))` and explicit `.public()`.
- Prefer `onboarding/queries.ts` pattern for admin history through `auditLog.queryByResource`, but return richer MIC request and portal context.
- Status filter defaults to `pending_review`; provisioning state and date range should be optional.
- Use existing indexes: `by_portal_status`, `by_portal_provisioning_state`, and `by_requested_at`.
- Keep query results compliance-visible; include `provisioningError`, WorkOS ids, active/processed journal ids where appropriate.

## Existing code touchpoints
- `convex/micInvestorAccessRequests/validators.ts`: status/provisioning validators.
- `convex/micInvestorAccessRequests/mutations.ts`: public request shape and normalization helper.
- `convex/onboarding/queries.ts`: admin query/history pattern.
- `convex/schema.ts`: `micInvestorAccessRequests` fields and indexes.
- GitNexus: no existing MIC query symbol; `appendAuditJournalEntry` and `executeTransition` are CRITICAL if modified and are not touched in this chunk.

## Validation
- Targeted tests for admin list default/filter behavior, detail/history payload, and non-admin rejection.
- `bun test src/test/convex/micInvestorAccessRequests`
