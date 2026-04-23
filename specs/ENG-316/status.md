# Execution Status: ENG-316 - Broker onboarding: add brokerOnboardingApplication aggregate and onboardingRequest handoff

- Overall status: complete
- Current phase: closeout
- Current chunk: none
- Last updated: 2026-04-23T14:59:09Z

## Active focus
- Review-finding closeout and user handoff.

## Blockers
- none

## Notes
- The implementation plan and issue agree that the aggregate boundary must be separate from `onboardingRequests`; the current provisioning GT remains the downstream handoff seam.
- The attached architecture docs still use `brokerOnboardings` wording in places, but the issue and implementation plan standardize the code-facing contract on `brokerOnboardingApplication` and `brokerOnboardingApplications`.
- The top-level lifecycle stays narrow. Step-specific progress and verification checkpoints should be encoded in `machineContext` and explicit typed fields instead of proliferating GT statuses.
- This slice is backend-only. E2E and Storybook work are expected to be non-applicable unless route or reusable UI scope appears during implementation.
- GitNexus pre-edit impact findings are all LOW risk: `machineRegistry`, `entityTypeValidator`, `ENTITY_TABLE_MAP`, and `requestRole` showed no indexed upstream dependents, while `lookupStatus` is only used by `lookupStatuses` inside `convex/engine/reconciliationAction.ts`.
- Validation completed successfully with `bun check`, `bunx convex codegen`, `bun typecheck`, and targeted Vitest coverage for machine, aggregate, and downstream handoff behavior.
- The latest review-finding pass resolved trusted portal attribution, terminal handoff replay stability, activation portal evidence, stale-candidate expiry, and fluent internal visibility.
- The `$linear-pr-spec-audit` verdict remains `ready`; no missing or contradicted ENG-316 requirements are recorded after the review-finding fixes.
