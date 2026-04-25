# Chunk Context: chunk-02-landing-components

## Goal
- Add the fixed-template landing presentation that renders the approved IA from `PublicPortalLandingPageContract`.

## Relevant plan excerpts
- "Render the approved page structure at `/` for valid portal hosts."
- "Trust proof must appear before the routing decision."
- "The top-level split is `Lender` versus `Borrower / Mortgage Applicant`."
- "Featured listings must read like the actual product and must not explain curation logic."

## Implementation notes
- Build production components under `src/components/portal/landing/`; do not import demo broker whitelabel modules.
- Use contract-provided CTA hrefs/labels for navigation, hero, switchboard, featured listings, nested financing actions, and inline submit.
- Teaser cards consume `featuredListings.items`, rendering at most the contract-visible items and a blurred continuation only when `hasBlurredContinuation` is true.
- Keep the page dense, work-focused, and responsive; avoid card-in-card nesting and visible instructional copy about implementation decisions.

## Existing code touchpoints
- `src/components/portal/landing/PortalLandingPage.tsx`: new composition component.
- `src/components/portal/landing/index.ts`: export new component and existing types.
- `src/components/ui/button.tsx`: existing button primitive for links/actions.

## Validation
- Targeted route/component tests.
- Browser verification if a dev server can be launched after implementation.
