# Summary: ENG-305 - Broker landing page: render the fixed-template production portal root

- Source issue: https://linear.app/fairlend/issue/ENG-305/broker-landing-page-render-the-fixed-template-production-portal-root
- Primary plan: https://www.notion.so/349fc1b44024810b91b2e9819dd39563
- Supporting docs:
  - Approved UI/UX Spec - Broker Landing Page (2026-04-21): https://www.notion.so/349fc1b440248161a5dad60b6e70eadc
  - ENG-303 landing contract plan: https://www.notion.so/349fc1b440248159ba12e6ae6764c25b
  - ENG-301 portal listings plan: https://www.notion.so/349fc1b440248152b73ddcf88614b510

## Scope
- Replace the current diagnostic `/` portal root with a production fixed-template broker landing page.
- Consume `api.portals.queries.getPublicPortalLandingPage` through the existing root `portalContext`.
- Render the locked IA: top navigation, broker-first hero, trust strip, two-path CTA switchboard, featured listings teaser, inline financing-start strip.
- Reuse live portal-aware listing data already embedded in the landing contract; avoid demo Zustand, mock-data, and demo route modules.
- Suppress generic shared application chrome on public portal root so landing navigation owns the page.
- Update route/component coverage for the production root renderer.

## Constraints
- FairLend must remain visible as operating/trust layer without overtaking broker branding.
- Trust strip must appear before the routing decision.
- Main switchboard is exactly `Lender` vs `Borrower / Mortgage Applicant`; pre-approval remains nested under financing.
- Featured listings must be neutral and product-like with no persona-targeting or curation explanation.
- Show at most three visible teaser cards, with a subtle blurred continuation only when the live contract says more inventory exists.
- Preserve root fail-closed behavior in `src/routes/__root.tsx` for invalid or unavailable portal hosts.
- CTA hrefs must be contract-driven, not hardcoded demo links.

## Open questions
- none
