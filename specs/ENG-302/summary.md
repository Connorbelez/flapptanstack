# Summary: ENG-302 - Broker portal: add explicit borrower portal attribution on onboarding and borrower records

- Source issue: https://linear.app/fairlend/issue/ENG-302/broker-portal-add-explicit-borrower-portal-attribution-on-onboarding
- Primary plan: https://www.notion.so/349fc1b440248168b41dd5b81d395faa
- Supporting docs:
  - https://www.notion.so/33ffc1b4402481f3b1f5d84c9cf98b0b
  - https://www.notion.so/33ffc1b44024815fb1ddc83c4d4195f9
  - https://www.notion.so/348fc1b44024817f80a4d4a442ffccbb

## Scope
- Add first-class `portalId: Id<"portals">` attribution to `borrowers` and `onboardingRequests`, including indexes that support explicit portal-scoped lookup and deterministic backfill.
- Persist `onboardingRequests.portalId` from the trusted current portal when a portal-aware onboarding request is created.
- Persist `borrowers.portalId` across canonical borrower provisioning and admin origination flows, plus seed and helper paths that create borrower rows directly.
- Implement deterministic backfill and unresolved-row reporting for existing onboarding and borrower rows, preferring onboarding attribution and otherwise falling back to the current `orgId -> portals.by_org` mapping.
- Cut portal borrower access and borrower-derived home portal assignment over from org-based inference to explicit borrower attribution without collapsing `users.homePortalId` into borrower entity ownership.
- Update targeted tests, fixtures, and proof coverage so wrong-portal borrower access fails closed.

## Constraints
- Broker subdomains remain tenant boundaries for onboarding attribution and access enforcement; the FairLend `app` portal stays inside the same contract as broker portals.
- `users.homePortalId` remains the viewer membership source of truth. This issue updates borrower entity attribution and the helper that derives `homePortalId`, but it must not replace user membership with borrower state.
- Portal membership stays structural in middleware. Resource checks remain resource-scoped; do not bury portal access back inside generic `resourceChecks`.
- The live code already contains the ENG-297 to ENG-300 stack on branch base commit `49cb04031`; use the real repo paths from this branch, not the stale file paths from the issue body on the older detached checkout.
- Current portal registry invariants still assume a single live portal per org via `portals.by_org`. Backfill may use that deterministic fallback, but ambiguous or unresolved rows must stay unset and be reported rather than guessed.
- This issue must fail closed for future same-org multi-portal scenarios without widening scope into full multi-portal write-path support beyond explicit attribution.

## Open questions
- none
