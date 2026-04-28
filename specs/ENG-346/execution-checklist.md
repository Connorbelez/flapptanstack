# Execution Checklist: ENG-346 - Deal closing: upgrade admin operations console

## Requirements From Linear
- [x] Replace the default `/admin/deals` experience with a phase-grouped operating pipeline that updates reactively and supports filters for needs action, blocked, awaiting signatures, awaiting funds, completed, and failed.
- [x] Cards must display server-projected lifecycle phase/sub-state, next valid action summary, blocker summary, normalized buyer/seller/lawyer labels, closing team assignment state, and fraction display percent from ENG-338 semantics.
- [x] Cards and console actions must render only valid governed events or subordinate document actions for the current server state; invalid actions must be hidden or disabled with a reason.
- [x] Payload-required actions must collect required payloads before calling mutations; cancellation must require a non-empty reason and submit `DEAL_CANCELLED` through `transitionDeal`.
- [x] Add or extend an admin deal operations projection in Convex that composes normalized participant/access/fraction, envelope/signing, funds/archive/close-effect, blocker, and audit timeline data.
- [x] Replace the generic `/admin/deals/$recordid` detail route with a dedicated operations console while preserving admin shell navigation and record context patterns.
- [x] The console must include lifecycle stage rail, package/envelope/signer status, parties/access state, reservation/locking-fee/funds/proration/reroute/archive outcomes, exceptions/blockers, and audit timeline.
- [x] The console must distinguish loading, no data, blocked, failed, completed, missing optional data, and missing upstream-contract states without crashing.
- [x] Admin auth must remain FairLend staff admin-gated on backend projections and frontend route access; external-org admins must not pass staff-global admin checks.
- [ ] Add focused query, view-model, component, route/integration, and e2e coverage for core admin flows and negative paths.
  - Partial: view-model, component, and direct Convex projection coverage exists; e2e spec was updated. E2e execution and auth denial-path verification remain blocked by environment.
- [x] Keep all exported Convex functions on fluent builders with explicit `.public()` or `.internal()` visibility and avoid `any` unless isolated and justified.

## Definition Of Done From Linear
- [x] `/admin/deals` opens to the operations pipeline, not only the generic entity table, with deals grouped by lifecycle phase and filterable by operational state.
- [x] `/admin/deals/$recordid` shows a dedicated operations console with lifecycle, package/signers, parties/access, financials, blockers/exceptions, and audit context.
- [x] All displayed parties, access roles, and fraction values come from ENG-338-compatible projection contracts.
- [x] Package, envelope, signer, exception, and reissue displays consume ENG-342-compatible projection contracts and do not expose participant-only signing tokens as admin controls.
- [x] Funds evidence, signed archive state, reservation, locking fee, proration, reroute, and close-effect outcome displays consume ENG-343-compatible projection contracts.
- [x] Admin actions submit governed events or subordinate document actions only; no UI code patches deal status directly or invents local lifecycle states.
- [x] Cancellation reason is required and written through the governed transition path.
- [x] Invalid or payload-incomplete actions are not enabled.
- [x] Missing partial data is visible, explicit, and non-crashing.
- [ ] FairLend staff admin access is enforced in route/backend paths; non-admin and external-org admin denial paths are covered.
  - Implementation uses the existing admin route and `adminQuery` backend gates. Negative denial-path execution is not verified because e2e is blocked by missing test auth environment.
- [x] Implementation follows the published Notion plan, adjusted to current codebase contracts present for ENG-338, ENG-342, and ENG-343.
- [ ] Implementation worktree runs GitNexus impact before editing shared symbols and runs `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests, `bun run test`, `bun run test:e2e`, and `bun run review` before completion.
  - GitNexus impact checks, `bunx convex codegen`, `bun check`, `bun typecheck`, and targeted tests passed. Full test/e2e/review gates remain blocked as recorded in `tasks.md`.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit/view-model tests added for phase grouping, filter buckets, blockers, next actions, partial data, and empty-state rules.
- [x] Convex projection tests added or updated for admin operations projection shape, participants, access, signing, close evidence, blockers, and audit timeline.
  - Added focused coverage for missing mortgage visibility, unknown upstream status handling, and server-projected governed actions; broader participant/access/signing/close-evidence/audit composition remains covered by React/view-model tests and implementation contracts.
- [x] Component/route tests added for pipeline, cards, console panels, payload dialogs, invalid action states, and loading/no-data/error states.
- [ ] E2E tests added or updated for admin pipeline, opening a console, cancellation with required reason, blocker/exception displays, and denial paths.
  - Spec updated; execution blocked by missing `TEST_ACCOUNT_EMAIL`.
- [x] Storybook stories considered; record why inapplicable if no reusable component story is added.

## Final Validation
- [ ] All requirements are satisfied.
  - Not fully satisfied because denial-path execution remains unverified in this environment.
- [ ] All definition-of-done items are satisfied.
  - Not fully satisfied because required validation gates are blocked.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted tests passed.
- [ ] `bun run test` passed.
  - Blocked by unrelated existing suite failures.
- [ ] `bun run test:e2e` passed or an explicit environment blocker is recorded.
  - Blocked by missing `TEST_ACCOUNT_EMAIL`.
- [ ] `bun run review` passed.
  - Blocked by CodeRabbit file-count limit.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
