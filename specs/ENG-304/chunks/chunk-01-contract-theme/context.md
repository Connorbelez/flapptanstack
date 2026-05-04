# Chunk Context: chunk-01-contract-theme

## Goal
- Add the constrained landing customization data contract, public projection, staff-managed mutation path, and Convex tests.

## Relevant plan excerpts
- "Customization must change tokens, copy, imagery, and allowed trust-strip content, not layout composition."
- "Recommendation: start with constrained tokens and copy overrides such as logo, hero copy, trust-strip items, palette tokens, and contact details."
- "Prefer staff-managed or constrained authoring before self-serve systems."
- "Keep customization additive and token-based rather than arbitrary block-based."

## Implementation notes
- Existing base contract uses `portalLandingPages.v1LandingContent` as the landing customization attachment.
- Extend that field with additive optional `brand` and `theme` groups.
- Keep href safety validation for all actions and add token validation for colors/image URLs as needed.
- Add a FairLend-admin mutation under `convex/portals` so staff can upsert the constrained config without broker self-serve UI.
- Public contract should provide defaults even when no customization exists.

## Existing code touchpoints
- `convex/portals/validators.ts`: `portalLandingPageContentValidator`, `publicPortalLandingPageValidator`, `validatePortalLandingPageContentSafety`.
- `convex/portals/queries.ts`: `buildNavigation`, `buildHero`, `buildLandingFallbacks`, `getPortalLandingPageContent`, `getPublicPortalLandingPage`.
- `convex/schema.ts`: `portalLandingPages` already stores `v1LandingContent`.
- `convex/portals/__tests__/landing.test.ts`: existing public contract tests.

## Validation
- `bun test convex/portals/__tests__/landing.test.ts`
- `bunx convex codegen`
