# Execution Checklist: ENG-355 - MIC portal: enforce protected route and host-aware auth boundary

## Requirements From Linear
- [x] Public MIC root `/` must remain accessible to unauthenticated visitors on a valid MIC portal host.
- [x] `/portal` must be classified as a portal-host route, not shared/marketing/admin.
- [x] `/portal` must require active portal context; reserved, unknown, suspended, archived, draft, unpublished, and misconfigured portal hosts fail closed.
- [x] `/portal` must require authentication before mounting query consumers.
- [x] `/portal` must require `mic:access`; unrelated `lender:access`, `portfolio:view`, `broker:access`, and `borrower:access` are insufficient.
- [x] `admin:access` may pass through existing admin super-permission behavior; do not create a custom admin bypass inside the route.
- [x] MIC sign-in CTA builds a host-aware sign-in URL that returns to `/portal` on the originating MIC host.
- [x] Wrong-portal authenticated users receive the existing host boundary / wrong portal behavior, not partial MIC data.
- [x] Add route tests for unauthenticated, unauthorized authenticated, approved MIC investor, admin override, wrong host, and inactive portal cases.
- [x] Keep route screens from subscribing to Convex before the Convex auth wrapper is ready.

## Definition Of Done From Linear
- [x] `mic.<domain>/` remains public.
- [x] `mic.<domain>/portal` is protected by active portal host, authentication, and `mic:access`.
- [x] The protected route uses the canonical Convex `Authenticated` / `AuthLoading` pattern.
- [x] Host-aware sign-in returns approved users to `/portal` on the MIC host.
- [x] Wrong-user, wrong-host, inactive-portal, and missing-permission cases fail closed.
- [x] Existing broker/listings/lender route tests still pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for route-host policy and route authorization behavior.
- [x] Route/component tests added or updated for `/portal` auth gating and MIC root sign-in return behavior.
- [x] E2E tests are not added in this slice because the Linear plan explicitly defers the full WorkOS browser journey to ENG-358.
- [x] Storybook stories are not added because this slice introduces only a protected placeholder shell, not a reusable visual component or dashboard state.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted route/auth tests passed.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
