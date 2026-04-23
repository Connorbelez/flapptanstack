# Spec Audit: ENG-316 - Broker onboarding: add brokerOnboardingApplication aggregate and onboardingRequest handoff

- Audit skill: `$linear-pr-spec-audit`
- Review target: current ENG-316 worktree diff against `HEAD`, including untracked aggregate and test files
- Last run: 2026-04-23T14:31:24Z
- Verdict: ready

## Spec Compliance Review

### Findings
- none

### Coverage Summary
- SATISFIED: 12
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0
- OUT_OF_SCOPE: 2

### Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | data model | Introduce a dedicated `brokerOnboardingApplications` aggregate and append-only review-entry table instead of reusing `onboardingRequests`. | `convex/schema.ts:508`, `convex/schema.ts:571` | Separate persistence boundary is explicit. |
| SATISFIED | lifecycle | Register `brokerOnboardingApplication` in the governed-transition engine and keep the top-level lifecycle narrow. | `convex/engine/types.ts:4`, `convex/engine/validators.ts:22`, `convex/engine/machines/registry.ts:16`, `convex/engine/machines/brokerOnboardingApplication.machine.ts:72` | States are exactly `draft`, `submitted`, `changes_requested`, `approved`, `rejected`, `activated`. |
| SATISFIED | reconciliation | Extend table mapping and reconciliation status lookups for the new entity type. | `convex/engine/types.ts:196`, `convex/engine/reconciliationAction.ts:134` | The new entity participates in status reconciliation. |
| SATISFIED | resumability | Preserve explicit 30-day resumability with `startedAt`, `lastActivityAt`, `expiresAt`, and expiry handling. | `convex/schema.ts:522`, `convex/onboarding/brokerApplication/helpers.ts:85`, `convex/onboarding/brokerApplication/mutations.ts:89` | Expiry is modeled explicitly, not as hidden TTL behavior. |
| SATISFIED | portal attribution | Capture `portalId` from the trusted portal or home-portal seam when the application is created. | `convex/onboarding/brokerApplication/helpers.ts:182`, `convex/onboarding/brokerApplication/mutations.ts:110` | The resolver follows the existing active portal and `users.homePortalId` pattern. |
| SATISFIED | verification and review thread | Persist normalized verification snapshots, recommendation metadata, reopened-field state, and typed append-only review-thread entries. | `convex/onboarding/brokerApplication/validators.ts:34`, `convex/onboarding/brokerApplication/validators.ts:192`, `convex/onboarding/brokerApplication/helpers.ts:283`, `convex/onboarding/brokerApplication/internal.ts:51` | Review entry types are constrained to `reviewer_note`, `broker_note`, and `system_event`. |
| SATISFIED | backend surface | Provide start, resume, read, submit, and broker-note flows that return server-owned state for thin route consumers. | `convex/onboarding/brokerApplication/mutations.ts:47`, `convex/onboarding/brokerApplication/mutations.ts:188`, `convex/onboarding/brokerApplication/mutations.ts:257`, `convex/onboarding/brokerApplication/mutations.ts:321`, `convex/onboarding/brokerApplication/queries.ts:13` | `startOrResume` and `getCurrent` cover the read or resume contract. |
| SATISFIED | handoff contract | Define the downstream `onboardingRequest` handoff contract, including explicit linkage fields and linkage mutations. | `convex/schema.ts:608`, `convex/schema.ts:621`, `convex/onboarding/brokerApplication/internal.ts:331` | The downstream request keeps a back-reference to the application. |
| SATISFIED | activation semantics | Make `activated` legal only after downstream provisioning reaches `role_assigned` and the portal or home-portal side effects are synchronized. | `convex/onboarding/brokerApplication/internal.ts:432`, `convex/onboarding/brokerApplication/internal.ts:492`, `convex/onboarding/brokerApplication/internal.ts:524`, `convex/onboarding/brokerApplication/internal.ts:547` | `approved` is intentionally distinct from `activated`. |
| SATISFIED | Convex export guardrail | Keep all exported Convex functions on fluent-convex builders with explicit visibility. | `convex/onboarding/brokerApplication/internal.ts:5`, `convex/onboarding/brokerApplication/internal.ts:26`, `convex/onboarding/brokerApplication/internal.ts:51`, `convex/onboarding/brokerApplication/internal.ts:116`, `convex/onboarding/brokerApplication/internal.ts:199`, `convex/onboarding/brokerApplication/internal.ts:260`, `convex/onboarding/brokerApplication/internal.ts:331`, `convex/onboarding/brokerApplication/internal.ts:432`, `convex/onboarding/brokerApplication/internal.ts:492` | The internal/admin-review/handoff functions now use fluent `convex.query()` / `convex.mutation()` chains ending in `.internal()`. |
| SATISFIED | tests | Add focused machine, aggregate, and downstream-handoff coverage for the new lifecycle and handoff semantics. | `convex/engine/machines/__tests__/brokerOnboardingApplication.machine.test.ts:21`, `src/test/convex/onboarding/brokerApplication.aggregate.test.ts:26`, `src/test/convex/onboarding/brokerApplication.handoff.test.ts:22` | Targeted Vitest coverage exercises creation, resume, expiry, review thread, handoff, and activation guards. |
| SATISFIED | quality gates | Run the required repo validation gates for this slice. | `bun check`, `bunx convex codegen`, `bun typecheck`, targeted `bun test` | All completed successfully on 2026-04-23 after addressing the review finding. |
| SATISFIED | naming contract | Standardize code on `brokerOnboardingApplication` or `brokerOnboardingApplications` instead of stale `brokerOnboardings` wording. | `convex/schema.ts:508`, `convex/engine/types.ts:4`, `convex/engine/machines/registry.ts:17` | The code-facing contract matches the issue and implementation plan terminology. |
| OUT_OF_SCOPE | e2e | Add E2E coverage only if route or real UI flow scope appears. | Issue and implementation plan scope | This slice is backend-only; no route behavior changed. |
| OUT_OF_SCOPE | storybook | Add Storybook coverage only if reusable UI surfaces are introduced. | Issue and implementation plan scope | No reusable UI component work was part of ENG-316. |

### Open Questions
- none

## Unresolved items
- none

## Next action
- ready for final review
