# Summary: ENG-303 - Broker landing page: define the v1 production portal template contract

- Source issue: https://linear.app/fairlend/issue/ENG-303/broker-landing-page-define-the-v1-production-portal-template-contract
- Primary plan: https://www.notion.so/349fc1b440248159ba12e6ae6764c25b
- Supporting docs:
  - https://www.notion.so/349fc1b440248161a5dad60b6e70eadc

## Scope
- Define one explicit public broker landing-page read model that combines portal identity, broker identity, optional landing copy, CTA destinations, inline financing labels, and portal-priced featured listing teaser data.
- Add only minimal optional content fields to the existing `portalLandingPages` attachment seam where current `portals`, `brokers`, and `listings` rows cannot derive approved v1 copy.
- Keep both FairLend `app` and broker portals on the same contract shape with deterministic fallbacks.
- Add frontend contract types so ENG-305 can render the approved IA without rediscovering backend field names.
- Add targeted Convex tests for fallback behavior, broker data composition, nested pre-approval, and teaser listing projection.

## Constraints
- Do not turn `portalLandingPages` into a CMS, editor, theme system, arbitrary blocks model, or self-serve authoring surface.
- Use `portalContext` and persisted portal rows as structural host data; leaf consumers should pass the already resolved portal id rather than re-resolving hosts.
- Use live broker data for brokerage name and licensing wherever available.
- Keep pre-approval nested under borrower or mortgage-applicant financing, never as a third top-level CTA peer.
- Keep teaser listings aligned to the live listing runtime and portal pricing projection; do not import demo stores or mock listing shapes.
- The teaser UI contract must not explain persona targeting or curation logic.

## Open questions
- none
