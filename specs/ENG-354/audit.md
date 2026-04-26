# Spec Audit: ENG-354 - MIC portal: build admin triage and provisioning workflow

- Audit skill: `$linear-pr-spec-audit`
- Review target: branch diff for `codex/eng-354-mic-admin-triage-provisioning`
- Last run: 2026-04-26T15:15:43Z
- Verdict: ready

## Findings
- No material spec-compliance gaps found.

## Unresolved items
- No code blockers.
- Live WorkOS validation still depends on the `micinvestor` role existing in the target WorkOS environment.

## Coverage Summary
- SATISFIED: 15
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0
- OUT_OF_SCOPE: 2

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | admin read model | Admins can list MIC access requests, defaulting to pending review, with portal/status/provisioning/date filters. | `convex/micInvestorAccessRequests/queries.ts`, `src/test/convex/micInvestorAccessRequests/queries.test.ts` | Filters and default pending path are covered. |
| SATISFIED | admin detail/history | Admin detail exposes request, portal, review/provisioning metadata, audit log events, and audit journal rows. | `convex/micInvestorAccessRequests/queries.ts`, `src/test/convex/micInvestorAccessRequests/queries.test.ts`, `src/test/convex/micInvestorAccessRequests/provisioning-effect.test.ts` | Detail view includes provisioning audit rows after effect completion. |
| SATISFIED | RBAC | Admin review functions require FairLend admin/admin review permission. | `convex/micInvestorAccessRequests/mutations.ts`, `src/test/convex/micInvestorAccessRequests/mutations.test.ts` | Non-admin approval is rejected. |
| SATISFIED | lifecycle | Approval uses the governed Transition Engine rather than direct status patching. | `convex/micInvestorAccessRequests/mutations.ts`, `convex/engine/machines/micInvestorAccessRequest.machine.ts` | Review metadata is patched after successful transition only. |
| SATISFIED | lifecycle | Rejection uses the governed Transition Engine, requires a non-empty trimmed reason, and does not schedule provisioning. | `convex/micInvestorAccessRequests/mutations.ts`, `src/test/convex/micInvestorAccessRequests/mutations.test.ts` | Tests assert no effects scheduled on rejection. |
| SATISFIED | provisioning | Approval schedules `provisionMicInvestorAccess`. | `convex/engine/machines/micInvestorAccessRequest.machine.ts`, `convex/engine/effects/registry.ts` | Effect is declared in the machine and registered. |
| SATISFIED | integration | WorkOS user resolution checks existing users by normalized email before creating a user. | `convex/engine/effects/micInvestorAccessRequests.ts`, `src/test/convex/micInvestorAccessRequests/provisioning-effect.test.ts` | Existing-user and create-user paths are covered. |
| SATISFIED | integration | MIC membership creation uses `organizationId=portal.orgId` and `roleSlug="micinvestor"`. | `convex/engine/effects/micInvestorAccessRequests.ts`, `src/test/convex/micInvestorAccessRequests/provisioning-effect.test.ts` | Test asserts exact WorkOS membership args. |
| SATISFIED | idempotency | Already-existing WorkOS membership is treated as idempotent success. | `convex/engine/effects/micInvestorAccessRequests.ts`, `src/test/convex/micInvestorAccessRequests/provisioning-effect.test.ts` | Duplicate membership provider error completes provisioning. |
| SATISFIED | idempotency | Provisioning is guarded by active and processed journal IDs. | `convex/micInvestorAccessRequests/internal.ts`, `src/test/convex/micInvestorAccessRequests/provisioning-effect.test.ts` | Processed journal skips WorkOS; competing active journal rejects. |
| SATISFIED | failure visibility | Provisioning failure leaves request `status="approved"` and records `provisioningState="failed"` plus `provisioningError`. | `convex/micInvestorAccessRequests/internal.ts`, `convex/engine/effects/micInvestorAccessRequests.ts`, `src/test/convex/micInvestorAccessRequests/provisioning-effect.test.ts` | Provider failure and unavailable portal are covered. |
| SATISFIED | auditability | Approval, rejection, provisioning success, and provisioning failure write audit evidence. | `convex/micInvestorAccessRequests/mutations.ts`, `convex/micInvestorAccessRequests/internal.ts`, `convex/engine/effects/micInvestorAccessRequests.ts`, tests under `src/test/convex/micInvestorAccessRequests` | Both audit log and audit journal paths are covered for provisioning. |
| SATISFIED | admin surface | Generic admin shell exposes MIC access requests for table/detail navigation. | `src/components/admin/shell/entity-registry.ts`, `src/test/admin/mic-investor-access-registry.test.ts` | Registered under Marketplace with table/detail support. |
| SATISFIED | tests | Convex tests cover list/detail, approve/reject, provisioning success/failure/idempotency, and non-admin rejection. | `src/test/convex/micInvestorAccessRequests/*.test.ts`, `src/test/admin/mic-investor-access-registry.test.ts` | Focused suite passed. |
| SATISFIED | validation | Required local validation commands pass. | `bunx convex codegen`, `bun check`, `bun typecheck`, focused `bun run test -- --run ...` | `bun check` still reports existing warning backlog but exits 0. |
| OUT_OF_SCOPE | e2e | Full browser E2E admin workflow. | ENG-354 execution checklist | Generic admin shell exposure only; no new composed admin workflow route was added. |
| OUT_OF_SCOPE | provider setup | Creating the WorkOS `micinvestor` role in the external WorkOS dashboard. | ENG-354 summary/open questions | Environment setup remains a manual prerequisite. |

## Open Questions
- None blocking code completion. Before production use, confirm the target WorkOS tenant has the `micinvestor` role slug configured.
