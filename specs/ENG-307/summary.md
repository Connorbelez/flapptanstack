# Summary: ENG-307 - Broker landing page: add borrower and mortgage-applicant portal-attribution handoff

- Source issue: https://linear.app/fairlend/issue/ENG-307/broker-landing-page-add-borrower-and-mortgage-applicant-portal
- Primary plan: https://www.notion.so/349fc1b44024816aaab2e1a006b12a41
- Supporting docs:
  - https://www.notion.so/349fc1b440248161a5dad60b6e70eadc
  - https://www.notion.so/349fc1b440248168b41dd5b81d395faa
  - https://www.notion.so/349fc1b44024810b91b2e9819dd39563

## Scope
- Add public financing-start continuation routes outside the auth-gated `/borrower` tree.
- Route the landing switchboard borrower CTA, nested pre-approval CTA, and inline financing strip into the same financing route family.
- Keep landing-page capture to lightweight prefill fields: full name, email, and amount needed.
- Preserve the resolved portal host and explicit `portalId` attribution through route loaders, UI contracts, and any backend continuation seam.
- Reuse the existing provisional application family where feasible; avoid production imports from demo mortgage-application or mocked Zustand flows.

## Constraints
- `/borrower/*` is authenticated and cannot be the anonymous landing entry point.
- Pre-approval must remain nested inside the financing route family, not a third top-level landing branch.
- Invalid or unavailable portal hosts must fail closed through the root portal boundary.
- ENG-302's explicit `portalId` contract is present locally: `borrowers.portalId`, `onboardingRequests.portalId`, and `resolvePortalBorrower` already key borrower access by `by_portal_user`.
- Host-aware auth transport exists in `src/lib/portal/auth-initiation.ts` and `src/lib/portal/auth-state.ts`; use it only when continuation actually requires auth.
- Current landing contract defaults point borrower actions to `/financing/start` and `/financing/pre-approval`; this issue should make those routes production surfaces.

## Open questions
- None blocking. The first iteration can be a public continuation surface that preserves portal and prefill context without creating borrower records until identity is available.
