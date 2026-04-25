# Execution Checklist: ENG-305 - Broker landing page: render the fixed-template production portal root

## Requirements From Linear
- [x] Replace the minimal `/` route with a production landing-page renderer that consumes the `ENG-303` landing contract.
- [x] Render the approved IA in this order: top navigation, broker-first hero, trust strip, two-path CTA switchboard, featured listings teaser, inline financing-start strip.
- [x] Keep FairLend visible as the operating and trust layer without overtaking broker branding.
- [x] Preserve root fail-closed portal behavior from `src/routes/__root.tsx`.
- [x] Reuse live portal-aware teaser listing data rather than demo state or mock data.
- [x] Render only three visible teaser cards plus a subtle blurred continuation to imply more inventory.
- [x] Keep teaser visuals product-like and neutral; never show persona-targeting explanations in the UI.
- [x] Keep pre-approval nested as a secondary action inside the financing side.
- [x] Make the page responsive on mobile and desktop without collapsing the information hierarchy.
- [x] Remove or bypass the generic shared header on public portal root so the landing page controls its own navigation chrome.
- [x] Keep lender and borrower CTA destinations driven by the landing contract and downstream handoff issues instead of hardcoded demo links.
- [x] Avoid demo route imports, Zustand stores, and mock-data modules entirely.

## Definition Of Done From Linear
- [x] A valid portal host renders the approved landing-page IA at `/` from production code.
- [x] The page reads as broker-first and trust-first rather than as generic app chrome.
- [x] The teaser section shows live, portal-aware listing data in a dedicated landing presentation.
- [x] Invalid or unavailable portal hosts still fail closed through the root boundary.
- [x] The shared global header no longer leaks generic product navigation into the public portal root.
- [x] The two-path CTA switchboard, teaser listings, and inline financing strip match the approved UI direction closely enough that downstream handoff work is wiring rather than redesign.
- [x] The renderer uses no demo-only data or state.
- [x] `ENG-306` and `ENG-307` can wire actions into this page without reopening layout questions.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit/component route tests updated for landing contract consumption and UI states.
- [x] E2E tests considered; full e2e was not run because this route-only renderer depends on seeded portal/Convex live data. Playwright smoke was run against local hosts and recorded in `audit.md`.
- [x] Storybook stories considered; not added because this is a route-owned fixed-template page, not a reusable Storybook component surface in the current repo.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] `bunx convex codegen` passed.
- [x] Targeted route/component tests passed.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
