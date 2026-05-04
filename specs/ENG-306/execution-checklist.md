# Execution Checklist: ENG-306 - Broker landing page: wire lender CTA and broker-attributed onboarding handoff

## Requirements From Linear
- [x] Introduce one canonical lender handoff contract for the landing page so the switchboard CTA, teaser-card clicks, and `View All` all converge on the same runtime.
- [x] Reuse the existing `lenderOnboardings` seam instead of inventing a separate landing-page-only onboarding record.
- [x] Record landing source attribution structurally, including `entryPath` and broker or subdomain context, when the lender journey starts.
- [x] Reuse host-aware sign-in or sign-up so unauthenticated users keep the correct portal host and safe return path.
- [x] Keep teaser-listing interactions in the same lender journey rather than branching into ad hoc routes.
- [x] Use the portal and listing runtime from `ENG-301` for lender-facing listing discovery and detail reads.
- [x] Keep invalid or unavailable hosts fail-closed through the existing portal boundary.
- [x] Avoid public routes nested under auth-gated trees unless the first step is intentionally authenticated.
- [x] Do not import demo lender-onboarding UI or mocked states.
- [x] Keep the v1 attribution contract deterministic and minimal; only expand schema if current fields cannot preserve required broker or portal context.

## Definition Of Done From Linear
- [x] The `Lender` switchboard CTA reaches one real production handoff path.
- [x] Featured-listing interactions and `View All` use the same lender journey family rather than separate landing-only paths.
- [x] Broker attribution is captured structurally in the onboarding or runtime seam.
- [x] Portal host context is preserved through auth redirects and resume behavior.
- [x] The flow uses live listing or runtime surfaces and no demo modules.
- [x] The handoff remains fail-closed on invalid or unavailable hosts.
- [x] The implementation does not depend on a shadow landing-specific onboarding stack.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Convex tests added for creating and resuming lender landing onboarding records with broker/subdomain/listing attribution.
- [x] Route/component tests updated so switchboard, teaser cards, and `View All` all point at the canonical handoff path.
- [x] Auth-state/auth-initiation tests updated if the signed auth payload shape changes.
  - No signed auth payload shape change was made.
- [x] E2E coverage is not required for this backend/route-linking slice unless the route contract changes beyond local route and server function behavior.
  - Covered by Convex and route/component tests; live WorkOS hosted-auth smoke remains a manual validation item.
- [x] Storybook is not required because no reusable visual component API is being introduced or redesigned.

## Final Validation
- [x] All requirements are satisfied
- [x] All definition-of-done items are satisfied
- [x] `bunx convex codegen` passed
- [x] `bun check` passed
- [x] `bun typecheck` passed
- [x] Targeted tests passed
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded
