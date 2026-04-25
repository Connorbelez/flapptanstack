# Summary: ENG-304 - Broker landing page: add broker customization and theming after v1 launch

- Source issue: https://linear.app/fairlend/issue/ENG-304/broker-landing-page-add-broker-customization-and-theming-after-v1
- Primary plan: https://www.notion.so/349fc1b440248101b8adc4a3140d0de2
- Supporting docs:
  - https://www.notion.so/349fc1b440248161a5dad60b6e70eadc
  - docs/architecture/broker-landing-page-contract.md

## Scope
- Extend the existing `portalLandingPages.v1LandingContent` contract with constrained brand and theme customization fields.
- Keep the public landing read model structurally shared through `api.portals.queries.getPublicPortalLandingPage`.
- Add a FairLend-admin mutation path for staff-managed portal landing customization.
- Update the shared landing renderer to consume theme tokens without changing section order or CTA hierarchy.
- Document safe customization fields and fixed IA boundaries.
- Add targeted Convex and route/component tests for fallback tokens, override application, safe validation, and preserved v1 IA.

## Constraints
- The fixed v1 IA stays locked: navigation, broker-led hero, trust strip, two-path lender vs borrower switchboard, product-like featured listings, and inline financing strip.
- Customization may change tokens, copy, imagery, and allowed trust-strip content only.
- Pre-approval remains nested under borrower or mortgage-applicant; it must not become a third peer CTA.
- Featured listings remain product-like and cannot become persona-marketing content.
- The data contract must remain additive to `v1LandingContent`, not a parallel CMS or arbitrary block model.
- Staff-managed mutation is acceptable for this post-v1 pass; broker self-serve tooling is out of scope.
- Public hrefs remain constrained to relative app paths and hash anchors.
- Admin updates must use existing FairLend staff authorization middleware.

## Open questions
- none
