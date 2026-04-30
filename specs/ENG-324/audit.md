# Spec Audit: ENG-324 - Broker onboarding: ship admin review queue and override workflow

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against real base
- Last run: 2026-04-24T13:42:00Z
- Verdict: needs manual validation

## Findings
- No ENG-324 spec-compliance gaps found.
- Residual validation blocker outside ENG-324: full `bun check` fails on pre-existing Biome complexity diagnostics in unrelated modules.
- Residual validation blocker outside ENG-324: full `bun run test` fails in unrelated CRM/listings/auth/payment tests.

## Unresolved items
- None for ENG-324 requirements or definition-of-done.
- Repo-wide quality gates need existing baseline cleanup outside this issue before the global suite can be green.

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | backend | Queue of reviewable applications with status, freshness, reason codes, timestamps, and latest human review note | `convex/onboarding/brokerApplication/queries.ts` | `listReviewQueue` exposes normalized triage fields and prefers broker/reviewer notes over system events for the summary. |
| SATISFIED | backend | Dossier exposes submitted data, normalized regulator/IDV evidence, reason codes, review thread, audit history, and downstream handoff | `convex/onboarding/brokerApplication/queries.ts` | `getReviewDossier` returns the read model, audit journal rows, queue item, review entries, and downstream onboarding request. |
| SATISFIED | backend | Approve, request-changes, and reject require explicit reviewer notes | `convex/onboarding/brokerApplication/mutations.ts`, `convex/onboarding/brokerApplication/internal.ts` | Public review actions trim and require notes before calling internal server-owned commands. |
| SATISFIED | backend | Request-changes carries reopened fields/sections and reverification flags | `convex/onboarding/brokerApplication/mutations.ts`, `convex/onboarding/brokerApplication/internal.ts`, `convex/onboarding/brokerApplication/validators.ts` | Empty reopened field lists are rejected; flags are persisted into metadata and verification invalidation state. |
| SATISFIED | backend | Broker notes share the append-only review thread | `convex/onboarding/brokerApplication/queries.ts`, `src/test/convex/onboarding/brokerReviewQueue.test.ts` | Dossier test verifies broker notes appear in `reviewEntries`; queue summary surfaces latest broker note. |
| SATISFIED | lifecycle | Review actions transition through server-owned commands instead of direct status patching | `convex/onboarding/brokerApplication/internal.ts` | Internal commands call `executeTransition` for approve/request-changes/reject before patching derived fields. |
| SATISFIED | frontend | Protected admin workspace for review queue and dossier | `src/routes/admin/broker-onboarding/route.tsx`, `src/lib/auth.ts`, `src/components/admin/broker-onboarding/BrokerOnboardingReviewPage.tsx` | Route is guarded with `adminBrokerOnboarding`; page is driven by backend query/action references. |
| SATISFIED | auth | FairLend staff boundary plus onboarding review permission | `convex/fluent.ts`, `convex/onboarding/brokerApplication/queries.ts`, `convex/onboarding/brokerApplication/mutations.ts`, `src/lib/auth.ts` | Backend uses `adminQuery`/`adminAction` and `requirePermission("onboarding:review")` / `requirePermissionAction("onboarding:review")`; route uses `fairLendAdminWithPermission`. |
| SATISFIED | frontend | Approval is distinct from activation and downstream provisioning state is visible | `src/components/admin/broker-onboarding/BrokerOnboardingReviewPage.tsx`, `src/test/convex/onboarding/brokerReviewActions.test.ts` | Dossier shows application state, handoff state, onboarding request status, activated broker, and activated portal. |
| SATISFIED | tests | Focused backend and route/component tests cover critical behavior | `src/test/convex/onboarding/brokerReviewQueue.test.ts`, `src/test/convex/onboarding/brokerReviewActions.test.ts`, `src/test/routes/admin/brokerOnboardingReview.test.ts` | Targeted ENG-324 test command passes. |

## Validation Evidence
- Pass: `bun run test -- src/test/convex/onboarding/brokerReviewQueue.test.ts src/test/convex/onboarding/brokerReviewActions.test.ts src/test/routes/admin/brokerOnboardingReview.test.ts`
- Pass: focused ENG-324 Biome check
- Pass: `bunx convex codegen`
- Pass: `bun typecheck`
- Blocked outside ENG-324: `bun check`
- Blocked outside ENG-324: `bun run test`
