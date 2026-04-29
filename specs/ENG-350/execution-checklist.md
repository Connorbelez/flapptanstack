# Execution Checklist: ENG-350 - Listing detail: enable hosted checkout launch UI

## Requirements From Linear
- [x] Replace read-only checkout copy with a production checkout launcher only when the listing is production-backed and server DTO says checkout is eligible.
- [x] Preserve read-only/non-action states for demo listings, missing `mortgageId`, unavailable listings, or backend-disabled checkout.
- [x] Let lender choose requested fraction count with bounds derived from server availability, but re-check server-side through ENG-340. The UI must not claim final availability authority.
- [x] Require lawyer selection before enabling checkout start. Support platform lawyer selection and guest lawyer snapshot with name/email/optional firm.
- [x] Display the CAD 250 lock fee as server-owned copy and never submit a client fee amount as authority.
- [x] On submit, call the ENG-340 checkout start API, show pending/loading state, and redirect the browser to the returned hosted Stripe Checkout URL.
- [x] Do not implement embedded Stripe Elements or PaymentIntent-first UI.
- [x] Render return states for success/pending, canceled/abandoned, expired, provider failure, and generic error using internal checkout state where available.
- [x] Preserve route auth wrapper pattern: authenticated route trees that render `useSuspenseQuery` must gate children with `Authenticated` / `AuthLoading`; do not subscribe before the Convex auth wrapper is ready.
- [x] Use `useAuth` from `@workos/authkit-tanstack-react-start/client` for frontend auth state if needed.
- [x] Make controls accessible, keyboard usable, and responsive. Text must not overflow buttons or cards on mobile.

## Definition Of Done From Linear
- [x] Production listing detail exposes a real hosted checkout launcher for eligible listings.
- [x] Lawyer and fraction inputs are feature-complete and accessible.
- [x] UI calls backend start API and redirects only to returned hosted Stripe URL.
- [x] Return/error/expired/abandoned states are rendered from internal state where available.
- [x] Demo/read-only/ineligible listings cannot start checkout.
- [x] Required commands pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit/RTL tests added or updated for launcher validation, disabled states, redirects, backend errors, and return states.
- [x] E2E coverage is evaluated; if not added, record why a mocked RTL route flow is sufficient for this UI slice.
  - Not added: hosted Stripe/provider behavior and webhook reconciliation are out of scope for ENG-350; RTL covers the UI launch contract and route/action handoff.
- [x] Storybook stories are evaluated; if not added, record why this existing page-level surface does not require story coverage.
  - Not added: the launcher is page-internal and covered by page-level RTL; no new reusable exported component/story surface was introduced.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed: `bunx convex codegen`, `bun check`, `bun typecheck`, and targeted tests.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
