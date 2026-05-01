# Execution Checklist: ENG-364 - Legal representation: add lender and admin lawyer status controls

## Requirements From Linear
- [x] Add a legal representation status projection with labels for platform selected, confirmation requested, confirmed, guest invitation sent, accepted, verified, restriction check, and blocked states.
- [x] Show the status projection in lender/admin deal views while the deal is before `documentReview.pending`.
- [x] Add resend invitation for pending guest invitations; it must issue a new delivery attempt or expose the same valid token according to policy without extending expiry unless explicitly designed.
- [x] Add change guest contact email; it must normalize the new email, invalidate old invitation tokens, create/send a new invitation, and audit old/new target.
- [x] Add select different lawyer before representation confirmation; it must revoke old lawyer active dealAccess, invalidate outstanding guest tokens, void/supersede pending engagement evidence, and store the new selectedLawyer.
- [x] Preserve dealAccess soft-delete behavior; never hard delete old access rows.
- [x] Every management action records actor, timestamp, previous state, new state, and affected lawyer references.
- [x] Do not allow a lender to manage a deal they cannot access.
- [x] Do not let management controls bypass ENG-363 verification/engagement gates.

## Definition Of Done From Linear
- [x] Lender/admin can see legal representation status without reading raw internal records.
- [x] Resend, change email, and swap are auditable and server-authorized.
- [x] Old invitations and old lawyer access cannot remain active after replacement.
- [x] Deal status remains governed by the Transition Engine.
- [x] Tests cover success, denial, stale action, and race cases.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for backend projection and management policy.
- [x] Route/component tests added or updated for lender/admin status display.
- [x] E2E tests added or explicitly justified if route flows are not fully automatable in this slice.
  - Justification: this slice depends on authenticated WorkOS/Convex sessions and invite-token delivery; behavior is covered by Convex integration tests plus route/component tests with typed fixtures.
- [x] Storybook stories added or explicitly justified if no reusable UI component/story surface changes require them.
  - Justification: no Storybook surface exists for these internal route-bound deal management panels; component behavior is covered in lender/admin tests.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted backend and route tests passed.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
