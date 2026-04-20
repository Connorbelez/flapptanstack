# Execution Checklist: ENG-299 - Broker portal: enforce portal membership in Convex middleware

## Requirements From Linear
- [x] Add reusable portal middleware that reloads canonical portal state from a trusted server-side portal identifier and rejects unavailable portals before handler logic.
- [x] Add same-portal access middleware keyed off `users.homePortalId` with explicit FairLend admin override only.
- [x] Add lender and borrower portal stages that resolve actor ownership against the current portal, reusing shared actor-resolution helpers.
- [x] Expose portal-aware fluent-convex builder chains rather than standalone helper functions.
- [x] Keep portal membership structural and ahead of `resourceChecks`; do not hide it inside resource-level access helpers.
- [x] Keep the FairLend `app` portal in the same contract as broker portals.
- [x] Add proof coverage or a thin proof consumer before `ENG-301` broadens adoption.

## Definition Of Done From Linear
- [x] Same-portal non-admin access succeeds through reusable portal builders.
- [x] Cross-portal non-admin access is denied before resource-level checks load protected data.
- [x] FairLend admin cross-portal access works only through explicit override.
- [x] Shared actor-resolution helpers are reused and portal context stays typed.
- [x] `bunx convex codegen`, `bun check`, `bun typecheck`, and targeted portal middleware tests pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests and Convex integration tests cover portal middleware, actor resolution reuse, and unchanged resource-scoped access behavior.
- [x] E2E tests are explicitly not required for this slice unless a real portal-sensitive route consumer is added during implementation.
- [x] Storybook coverage is not applicable because this issue is backend/runtime middleware with no reusable UI changes.

## Final Validation
- [x] All requirements are satisfied
- [x] All definition-of-done items are satisfied
- [x] Required quality gates passed
- [x] Test coverage expectations were met or explicitly justified
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded
