# Broker Landing Page Contract

ENG-303 defines the v1 production broker landing-page contract as a thin read model, not a CMS.

## Structural Runtime Dependencies

- `portals` owns host and routing structure: portal id, slug, portal type, production/local hosts, teaser flags, default post-auth path, broker id, landing-page attachment id, and pricing policy.
- `brokers` owns broker identity: brokerage name, license id, and license province.
- `listings` owns teaser inventory through the live marketplace projection and portal pricing policy.

Leaf landing consumers should receive a resolved `portalId` from root `portalContext` and call `api.portals.queries.getPublicPortalLandingPage`. They should not re-resolve hosts.

The public landing query is fail-closed: it returns a contract only when the portal resolves to active public availability. Draft, suspended, archived, unpublished, or pricing-misconfigured portals return `null`.

## Safe Customization Surface

The only optional customization for v1 lives on `portalLandingPages.v1LandingContent`.

This field can override constrained copy, brand, and theme values:

- brand logo URL and logo alt text
- theme color tokens: background, surface, text, muted text, border, primary, primary hover, and accent
- top navigation items and right-side label
- hero eyebrow, headline, body, and actions
- trust-strip labels
- switchboard intro, lender copy, borrower or mortgage-applicant copy, and nested borrower actions
- featured-listing label, subcopy, view-all action, and visible card count
- inline financing-strip copy, fields, and submit action

The shape is intentionally fixed to the approved v1 IA. It does not support arbitrary blocks, freeform theme engines, custom layouts, component selection, or self-serve authoring.

CTA and navigation hrefs are constrained to relative app paths such as `/listings` or hash anchors such as `#contact`. Protocol URLs, protocol-relative URLs, JavaScript URLs, and whitespace-bearing hrefs are rejected before copy is returned from the public contract.

Brand logo URLs are constrained to either root-relative app paths or `https://` URLs. Color tokens are constrained to 3- or 6-digit hex colors. These constraints intentionally keep theming token-based instead of opening a freeform CSS or CMS surface.

The first management path is staff-managed: FairLend admins can upsert this attachment through `api.portals.landingMutations.upsertPortalLandingPageContent`. Broker self-serve editing remains out of scope until a later product decision.

## Fixed Fields

The following remain fixed in code and cannot be customized through the landing content attachment:

- section order: navigation, broker-led hero, trust strip, two-path switchboard, featured listings teaser, inline financing strip
- top-level CTA split: lender vs borrower or mortgage applicant
- pre-approval hierarchy: nested borrower action only, not a third peer CTA
- featured-listing card structure and live listing projection source
- portal host resolution, public availability checks, and pricing-policy gating
- arbitrary block composition, custom components, custom CSS, and broker self-serve authoring

## Fallback Policy

Missing optional copy must not break root rendering.

- Brand label falls back to `brokers.brokerageName`, then `FairLend` for the app portal, then a title-cased portal slug.
- Brand logo falls back to no image and an alt label based on the brand label.
- Theme tokens fall back to the default approved v1 palette.
- Licensing trust copy falls back to broker license data when present, otherwise generic licensed-brokerage trust copy.
- Lender action falls back to `/listings`.
- Borrower financing action falls back to `/financing/start`.
- Pre-approval remains nested under borrower financing and falls back to `/financing/pre-approval`.
- Featured listings use live portal-priced listing projection when public teasers and active portal pricing are available; otherwise the section returns an empty teaser array without changing the contract shape.
- Featured listing count is capped by both v1 landing content and `portals.teaserListingLimit`; a zero portal teaser limit returns no listing items.

## Out Of Scope

- CMS/editor workflows
- freeform theming or custom CSS
- arbitrary page blocks
- persona-targeting explanations in teaser UI
- demo listing or mock store imports
