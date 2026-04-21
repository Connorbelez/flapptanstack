# Execution Checklist: ENG-309 - Lender portfolio: register lender renewal intent in the transition engine

## Requirements From Linear
- [x] Register `lenderRenewalIntent` as a real governed machine without changing the existing semantics of unrelated machines.
- [x] Keep all status-field mutation inside the transition engine. No direct status writes are allowed outside governed transitions.
- [x] Support the four required states and lender/system events described in the goal, including change-mind flows before maturity.
- [x] Add auto-create behavior for lenders holding positions in mortgages entering the 180-day maturity window.
- [x] Add auto-expire behavior for unsigned intents whose 60-day deadline has passed.
- [x] Expose a lender-facing mutation/query surface guarded by structural auth and `portfolio:signal_renewal`.
- [x] If notifications are scheduled, reuse the existing engine effect registry/stub pattern. Do not build a brand-new notification subsystem in this issue.
- [x] Keep borrower linkage optional and non-blocking; the runtime must work even when no borrower renewal entity exists.

## Definition Of Done From Linear
- [x] `lenderRenewalIntent` is a registered governed machine with the required states and events.
- [x] Intent creation, signaling, change-mind, and expiry all flow through governed transitions.
- [x] The runtime remains additive and does not alter unrelated transition semantics.
- [x] Public signal/read surfaces are structurally permissioned.
- [x] Targeted tests and repo validation commands pass.

## Plan-Derived Contract Checks
- [x] `borrowerRenewalIntentId` remains an optional string link and never becomes a required runtime dependency.
- [x] Reconciliation no longer skips `lenderRenewalIntent` once the machine is live.
- [x] Renewal-intent creation and expiry entrypoints are idempotent across cron reruns.
- [x] Partial-exit validation is centralized and enforces the 100-fraction minimum against the lender's held position.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests are added or updated for the new machine, registry wiring, transition behavior, scheduler logic, and portal renewal validation in scope.
- [x] E2E tests are not required for ENG-309 unless the implementation unexpectedly changes a real routed lender workflow.
  Planned expectation: downstream lender-portfolio UI issues own browser-level coverage for renewal actions.
- [x] Storybook is not applicable for ENG-309 because this slice does not add or change reusable UI components.

## Final Validation
- [x] All requirements are satisfied
- [x] All definition-of-done items are satisfied
- [x] Required quality gates passed
- [x] Test coverage expectations were met or explicitly justified
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded
