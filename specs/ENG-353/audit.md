# Spec Audit: ENG-353 - MIC portal: add public access request intake

- Audit skill: `$linear-pr-spec-audit`
- Review target: branch diff against current base
- Last run: 2026-04-26T01:23:52Z
- Verdict: ready

## Findings
- none

## Unresolved items
- none for ENG-353 spec compliance
- Validation caveat: full `bun run test` has a persistent unrelated failure in `convex/demo/__tests__/ampsE2e.test.ts`:
  - `runs the full inbound-to-outbound offline lifecycle for a run-scoped scenario` remains at `dispersal_ready` instead of `outbound_pending_confirmation`.
  - `seed replay and payout replay stay idempotent for the same runId` returns `firstPayout.created = 0` instead of `1`.
  - The failing file reruns alone with the same two failures and does not touch the MIC request table, mutation, portal validation, or audit path.

## Next action
- none for this issue

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | data model | Dedicated `micInvestorAccessRequests` entity with documented fields and indexes | `convex/schema.ts` | Includes status, provisioning fields, review metadata, portal/email/status indexes, requestedAt index. |
| SATISFIED | lifecycle | Governed `pending_review -> approved | rejected` machine exists | `convex/engine/machines/micInvestorAccessRequest.machine.ts`, `convex/engine/machines/registry.ts` | Added to governed entity registry and table map. |
| SATISFIED | public mutation | Public email-only request submission for active MIC portals | `convex/micInvestorAccessRequests/mutations.ts` | Uses `convex.mutation()` without auth middleware and `.public()`. |
| SATISFIED | validation | Email is trimmed, lowercased into `normalizedEmail`, and email-like validation rejects invalid values | `normalizeMicInvestorAccessRequestEmail`, `mutations.test.ts` | Tests cover helper and mutation rejection. |
| SATISFIED | portal guard | Non-MIC, inactive, unpublished, missing mapping, and deleted portal ids fail closed | `resolveMicPortalConfig` call in mutation, `mutations.test.ts` | Tests cover non-MIC, unpublished, suspended, missing mapping, deleted portal. |
| SATISFIED | idempotency | Pending/approved duplicates return generic success without new active row | mutation duplicate lookup, `mutations.test.ts` | Tests cover pending, approved, and concurrent duplicate submissions. |
| SATISFIED | rejected resubmission | Rejected prior request can create new pending request | mutation only checks pending/approved, `mutations.test.ts` | Test verifies one rejected and one pending row can coexist. |
| SATISFIED | generic return | Create and reuse paths return `{ ok: true, status: "received" }` | return validator and tests | No ids or internal statuses returned. |
| SATISFIED | audit | Actual creation writes audit journal and audit log rows | `appendAuditJournalEntry`, `auditLog.log`, `mutations.test.ts` | Journal uses required entity/event/state fields. |
| SATISFIED | negative scope | Does not reuse `onboardingRequests` or authenticated role request logic | new `convex/micInvestorAccessRequests/*` module | `requestRole` inspected but not edited. |
| OUT_OF_SCOPE | frontend | Public landing-page form and visual presentation | Linear issue out-of-scope | ENG-357 owns UI wiring. |
| OUT_OF_SCOPE | admin/provisioning | Admin review, WorkOS invite/membership provisioning, email notifications | Linear issue out-of-scope | Entity stores future provisioning metadata only. |
