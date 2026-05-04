# Summary: ENG-333 - Velocity package: implement reviewed activation orchestration and all-or-nothing handoff

- Source issue: https://linear.app/fairlend/issue/ENG-333/velocity-package-implement-reviewed-activation-orchestration-and-all
- Primary plan: https://www.notion.so/34bfc1b44024813ca265f833c6d642c2
- Supporting docs:
  - https://www.notion.so/34bfc1b4402481038512d36fe9d3b2a2
  - https://www.notion.so/34bfc1b4402481e1a669db246c6a5869

## Scope
- Build the Velocity activation coordinator and activation-attempt lifecycle for reviewed packages.
- Map reviewed Velocity package state plus package-owned remediation fields into `VelocityActivationHandoffV1`.
- Provision or reuse Rotessa/provider artifacts under the Velocity activation idempotency key before creating a live canonical mortgage.
- Finalize canonical mortgage activation only after provider activation succeeds or a previously created provider artifact is safely reusable.
- Persist failed activation metadata, remediation exceptions, provider references, package audit entries, and downstream mortgage audit provenance.
- Record post-live Velocity drift as package exceptions and snapshots instead of mutating canonical mortgage facts.

## Constraints
- Activation must refuse packages whose reviewed snapshot hash no longer matches the current normalized hash.
- Current Velocity status must be exactly `Funded (6)`; `Complete (7)` before activation remains remediation.
- Missing canonical inputs such as `loanType` and `lienPosition` must come from package-owned `activationRemediation`; no local defaults.
- `workflowSourceKey` must remain `velocity_package:mortgage:<linkApplicationId>` so duplicate activation does not duplicate mortgages.
- The Velocity path must not copy `runPostCommitCollectionsActivation`, where the admin flow creates a mortgage and only then attempts provider activation.
- Existing `activateMortgageAggregate` inserts `mortgages.status = active`; the Velocity orchestration must call it only after provider success is known.
- Later Velocity syncs after activation must create `live_drift_exception` records and `post_live_drift` snapshots, not patches to mortgage, borrower, property, obligation, collection-plan, or listing financial fields.

## GitNexus Impact Notes
- `activateMortgageAggregate`: LOW upstream impact; direct caller is `convex/admin/origination/commit.ts`.
- `bootstrapOriginationPayments`: LOW upstream impact; direct callers are `activateMortgageAggregate` and its replay helper.
- `beginRecurringScheduleActivation`: LOW upstream impact; no direct caller was reported by GitNexus due dynamic function references.
- Some exported Velocity helper symbols were not found by GitNexus name lookup after reindexing; file-level context was inspected directly before planning.

## Open questions
- none
