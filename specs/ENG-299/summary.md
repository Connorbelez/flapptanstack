# Summary: ENG-299 - Broker portal: enforce portal membership in Convex middleware

- Source issue: https://linear.app/fairlend/issue/ENG-299/broker-portal-enforce-portal-membership-in-convex-middleware
- Primary plan: https://www.notion.so/348fc1b44024817f80a4d4a442ffccbb
- Supporting docs:
  - https://www.notion.so/33ffc1b4402481f3b1f5d84c9cf98b0b
  - https://www.notion.so/33ffc1b44024815fb1ddc83c4d4195f9

## Scope
- Consume the `ENG-297` portal registry and `users.homePortalId` contract rather than recreating portal persistence.
- Add shared actor-resolution helpers for user, broker, borrower, and lender lookups keyed by `viewer.authId`.
- Add reusable portal middleware that reloads portal state from a trusted server-side identifier, fails closed for unavailable portals, enforces same-portal membership, and supports explicit FairLend admin override.
- Add portal-aware fluent-convex builders and a thin proof consumer so downstream slices can adopt the new structural boundary without ad hoc checks.
- Keep borrower attribution in `ENG-299` narrow and transitional by resolving `borrowers.orgId -> portals.by_org -> portalId` rather than adding new schema fields here.
- Add regression coverage for same-portal success, cross-portal denial, explicit admin override, and missing or mismatched actor attribution.

## Constraints
- Current `main` in this worktree does not contain the blocked `ENG-297` dependency; this run is based on `origin/eng-297` so the portal registry contract is available.
- Portal membership must remain structural and must execute before resource-level access helpers; do not hide portal checks inside `convex/auth/resourceChecks.ts`.
- Exported Convex endpoints must remain on fluent-convex builders with explicit `.public()` or `.internal()`.
- Admin cross-portal access must stay explicit and narrow through the FairLend admin seam; non-admin roles must not inherit cross-portal access implicitly.
- The FairLend `app` portal must flow through the same contract as broker portals; no special fallback path outside the portal row.
- This issue does not expand into WorkOS callback logic, portal registry schema creation, pricing math, or broad portal-listing consumer rewrites.
- Explicit borrower and onboarding `portalId` fields, migration, and backfill are owned by `ENG-302`, not this issue.
- Missing portal ownership data or ambiguous borrower/lender attribution must fail closed.

## Open questions
- none
