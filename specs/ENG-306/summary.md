# Summary: ENG-306 - Broker landing page: wire lender CTA and broker-attributed onboarding handoff

- Source issue: https://linear.app/fairlend/issue/ENG-306/broker-landing-page-wire-lender-cta-and-broker-attributed-onboarding
- Primary plan: https://www.notion.so/349fc1b4402481c69c14e78ac48cf8c6
- Supporting docs:
  - https://www.notion.so/349fc1b440248161a5dad60b6e70eadc
  - ENG-301 portal listing runtime
  - ENG-305 production portal root

## Scope
- Wire the lender half of the broker landing switchboard, featured listing card clicks, and `View All` into one canonical public lender handoff path.
- Reuse the existing `lenderOnboardings` table as the persisted broker-attributed acquisition seam.
- Record deterministic attribution when the landing journey starts: `entryPath`, broker id, subdomain or portal slug, and optional listing intent.
- Keep the first anonymous step outside auth-gated trees, then reuse host-aware sign-up/sign-in with a safe return path into `/listings`.
- Use the ENG-301 listing runtime already present in this checkout for the post-auth listings destination.

## Constraints
- Do not create a shadow landing-only lender onboarding flow.
- Do not import demo lender onboarding UI, demo routes, Zustand stores, or mock data into the production path.
- Invalid, unknown, reserved, unpublished, suspended, or misconfigured hosts must remain fail-closed through the existing root portal boundary and auth initiation guard.
- `/listings` is auth-gated, so the public handoff route must live outside `/listings` and outside `/lender/*`.
- Keep schema expansion minimal; current `lenderOnboardings.entryPath`, `brokerId`, and `subdomain` can preserve v1 attribution.
- Existing repo reality: ENG-301 and ENG-305 are present locally. `src/routes/index.tsx` renders `PortalLandingPage`, `convex/portals/queries.ts` provides live teaser listing contracts, and `/listings` is the authenticated portal-aware marketplace.

## Open questions
- none
