# Chunk Context: chunk-02-landing-handoff-ui

## Goal
- Wire the already-rendered landing-page borrower actions and inline strip into the production financing route family without expanding the landing page into an application surface.

## Relevant plan excerpts
- "Route the top-level financing CTA, nested pre-approval CTA, and inline financing strip into the same route family."
- "Keep the landing page limited to path selection and lightweight prefill; move real form continuation to dedicated screens."
- "Do not split pre-approval back into a third top-level peer CTA."

## Implementation notes
- Prefer backend landing contract defaults over hardcoded component-level links.
- If changing default actions, keep safe relative hrefs accepted by `validatePortalLandingPageContentSafety`.
- Inline strip form should submit with GET so lightweight prefill is visible and resumable.
- Do not add large state management, full borrower application forms, or demo imports to `PortalLandingPage`.

## Existing code touchpoints
- `convex/portals/queries.ts`: `buildNavigation`, `buildSwitchboard`, and `buildFinancingStrip`.
- `src/components/portal/landing/PortalLandingPage.tsx`: `LandingActionLink`, switchboard nested action links, and financing strip form.
- `src/test/routes/portal-home-route.test.tsx`: current route/component coverage for landing links and inline strip contract.

## Validation
- Route/component tests prove primary borrower CTA, pre-approval CTA, and inline strip all land in the `/financing/*` route family.
