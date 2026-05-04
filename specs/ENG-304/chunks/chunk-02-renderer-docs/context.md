# Chunk Context: chunk-02-renderer-docs

## Goal
- Apply constrained theme/brand tokens in the shared landing renderer and document what is customizable versus fixed.

## Relevant plan excerpts
- "Keep the landing page renderer structurally shared across FairLend and broker portals."
- "Post-v1 customization layers on top of the approved broker-first hero, trust strip, two-path CTA switchboard, product-like featured listings teaser, and short inline financing start."
- "Avoid generalized block composition and full CMS scope."

## Implementation notes
- Use CSS custom properties or equivalent local shared styling so one `PortalLandingPage` component continues rendering all portal pages.
- Token overrides may affect color expression and brand imagery; they must not add/remove/reorder sections or change path hierarchy.
- Documentation should explicitly call out safe fields: brand label/logo, nav copy, hero copy/actions, trust strip labels, switchboard copy/actions within fixed slots, featured listing labels/count cap, financing fields/actions, and theme palette tokens.
- Documentation should explicitly call out fixed fields: section order, lender vs borrower split, nested pre-approval, product-like listing card structure, live listing data source, href safety, and absence of arbitrary blocks.

## Existing code touchpoints
- `src/components/portal/landing/PortalLandingPage.tsx`
- `src/test/routes/portal-home-route.test.tsx`
- `docs/architecture/broker-landing-page-contract.md`

## Validation
- `bun test src/test/routes/portal-home-route.test.tsx`
- `bun check`
- `bun typecheck`
