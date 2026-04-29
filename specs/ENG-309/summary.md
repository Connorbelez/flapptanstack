# Summary: ENG-309 - Lender portfolio: register lender renewal intent in the transition engine

- Source issue: https://linear.app/fairlend/issue/ENG-309/lender-portfolio-register-lender-renewal-intent-in-the-transition
- Primary plan: https://www.notion.so/349fc1b44024810187c8d57f2fae659c
- Supporting docs:
  - https://www.notion.so/318fc1b4402481cda6dfc6381b99d9fb

## Scope
- Register `lenderRenewalIntent` as a real governed entity by extending the governed type surface, adding a dedicated XState machine, and wiring it into the registry without changing unrelated transition behavior.
- Add the minimal runtime surface for lender renewal intent reads, lender signaling/change-of-intent commands, and scheduler-driven creation and expiry.
- Reuse existing mortgage maturity, portal auth, ledger ownership, and transition-engine seams rather than inventing a parallel renewal runtime.
- Add targeted machine, transition, portal, and scheduler coverage plus the required repo validation and final spec audit.

## Constraints
- Keep the implementation additive. `executeTransition` is a shared hot spot with `CRITICAL` GitNexus upstream impact, so this issue should avoid changing `convex/engine/transition.ts` unless the code proves it is unavoidable.
- All renewal status changes must flow through the transition engine. No direct writes to `lenderRenewalIntents.status` are allowed outside governed transitions.
- `borrowerRenewalIntentId` stays an optional string link only. The lender renewal runtime must work even when no borrower renewal entity exists.
- Lender-facing commands must derive lender identity from WorkOS auth plus portal middleware. Do not trust client-supplied lender or broker identifiers.
- Public lender renewal mutations and any sensitive renewal reads must require structural portal auth and `portfolio:signal_renewal`.
- Partial exit validation must stay centralized and must enforce positive values, held-position ceilings, and the 100-fraction product minimum.
- If transition side effects are needed, reuse the existing GT effect registry/stub pattern. Do not create a separate notification subsystem in this slice.

## Open questions
- none
