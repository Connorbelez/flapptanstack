# Spec Audit: ENG-333 - Velocity package: implement reviewed activation orchestration and all-or-nothing handoff

- Audit skill: `$linear-pr-spec-audit`
- Review target: local branch diff for ENG-333 in `/Users/connor/.codex/worktrees/4ef4/fairlendapp`
- Last run: 2026-04-24T14:12:11-04:00
- Verdict: ready

## Findings
- none

## Review Remediation
- Addressed parallel review findings around activation idempotency, provider compensation, Rotessa lookup/reuse after lost responses, audit payload completeness, duplicate-sync drift precedence, borrower role overrides, stale exception cleanup, audit event validator parity, and Rotessa API error classification.
- Added regression coverage in `src/test/convex/velocity/activation.test.ts`, `src/test/convex/velocity/sync.test.ts`, and `src/test/convex/velocity/contracts.test.ts`.

## Unresolved items
- none

## Coverage Summary
- SATISFIED: 12
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0
- OUT_OF_SCOPE: 1

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | activation preconditions | Activation requires final review, reviewed snapshot hash still current, and activation-ready readiness. | `convex/velocity/activation.ts` `assertFinalReviewMatches`, `assertActivationReadiness`; `src/test/convex/velocity/activation.test.ts` changed-hash refusal test | Readiness includes exact Velocity `Funded (6)` status semantics. |
| SATISFIED | canonical mapping | Missing canonical inputs such as `loanType` and `lienPosition` come from package-owned remediation, with no defaults. | `convex/velocity/activationMapper.ts` requires `activationRemediation.loanType` and `activationRemediation.lienPosition`; remediation refusal test | No fallback value is introduced by the mapper. |
| SATISFIED | idempotency | `workflowSourceKey` prevents duplicate canonical mortgages and successful activation retries return the existing succeeded attempt before stale readiness/live checks. | `convex/velocity/activation.ts` checks activation attempt idempotency before activation preconditions; `convex/mortgages/activateMortgageAggregate.ts` keeps replay-safe source-key behavior; idempotent start and duplicate success tests | Uses `velocity_package:mortgage:<linkApplicationId>`. |
| SATISFIED | provider orchestration | Rotessa customer/schedule artifacts are created, looked up, reused, or compensated before live mortgage creation. | `activateVelocityPackage`, `resolveOrCreateRotessaCustomer`, `resolveOrCreateRotessaSchedule`, `compensateRotessaSchedule`, `recordVelocityRotessaCustomerRef`, `recordVelocityRotessaScheduleRef`, `finalizeVelocityPackageActivation`; retry and compensation tests | Mortgage finalization requires `rotessaScheduleRef`; provider schedule is deleted if canonical finalization fails after provider success. |
| SATISFIED | provider failure | Provider schedule failure does not create a live canonical mortgage. | Provider failure test asserts no mortgage and no external collection schedule | Failure is persisted on attempt and workspace exception. |
| SATISFIED | retry | Retry reuses recorded provider refs instead of duplicating them silently. | Retry test asserts one customer create across two attempts and provider artifact reuse audit event | Schedule is retried because no schedule ref existed after failed provider call. |
| SATISFIED | activation attempts | Attempts persist stage-level status, provider refs, canonical refs, and failure metadata. | `velocityActivationAttempts` patches across activation mutations; failure/success tests | Attempt carries customer, schedule, mortgage, listing, external schedule, and failure fields. |
| SATISFIED | atomic handoff | Live mortgage is created only after provider schedule success, then provider-managed collection links are committed in the same finalization mutation. | `finalizeVelocityPackageActivation` creates mortgage aggregate only after requiring `rotessaScheduleRef`, then patches plan entries/schedule/mortgage | Convex mutation atomicity protects partial canonical finalization. |
| SATISFIED | post-live drift | Later Velocity changes after activation create drift exceptions/snapshots and do not mutate canonical facts, even when the incoming raw hash was synced before activation. | `convex/velocity/sync.ts` post-live branch runs before successful duplicate replay; drift tests assert mortgage payment and workspace hash unchanged | Snapshot type is `post_live_drift`; failed/exception duplicate syncs still replay their original terminal attempt. |
| SATISFIED | mortgage audit provenance | Velocity provenance flows into canonical mortgage audit journal. | `activateMortgageAggregate` emits `VELOCITY_PACKAGE_ACTIVATED` with activation attempt, reviewed snapshot id/hash, workspace id, and Rotessa refs; retry test asserts event payload/links | Audit origin system is `velocity_package`. |
| SATISFIED | package audit | Review, activation start/stages, provider artifact record/reuse, failure, success, and drift are audit-visible. | `convex/velocity/activation.ts`, `convex/velocity/contracts.ts`, `convex/velocity/sync.ts`; tests assert relevant event types and validator parity | Provider artifact event literals are included in the runtime validator. |
| SATISFIED | validation | Required quality gates pass for the ENG-333 slice. | `bun check`, `bunx convex codegen`, `bun typecheck`, targeted Velocity activation/sync/contract tests | Full `bun run test` was re-attempted and failed on existing unrelated suites plus one Velocity duplicate replay regression; the Velocity regression was fixed and focused Velocity tests passed afterward. |
| OUT_OF_SCOPE | frontend | Final review/activation UI wiring. | ENG-333 summary states ENG-334 owns UI wiring | Backend-only slice. |

## Open Questions
- none
