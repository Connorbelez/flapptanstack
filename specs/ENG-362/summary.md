# Summary: ENG-362 - Legal representation: implement guest invitations and WorkOS identity resolution

- Source issue: https://linear.app/fairlend/issue/ENG-362/legal-representation-implement-guest-invitations-and-workos-identity
- Primary plan: https://www.notion.so/350fc1b440248106b674e4a112640278
- Supporting docs:
  - https://www.notion.so/313fc1b4402481f3bd3df897435738e7
  - https://www.notion.so/313fc1b4402481e59483ec6db372777a
  - https://www.notion.so/313fc1b4402481319c0dd0927cdb3f11
  - docs/architecture/rbac-and-permissions.md
  - docs/convex/convex-dev-workos-authkit.md

## Scope
- Implement secure guest lawyer invitation lifecycle for deals with `selectedLawyer.type = "guest_lawyer"`.
- Add hash-only single-use token generation, expiry, resend invalidation, acceptance, verification, and remediation status.
- Resolve or provision guest lawyer profiles through a WorkOS-aware boundary using canonical `lawyer` role semantics.
- Migrate provisional normalized-email `guest_lawyer` dealAccess to resolved WorkOS auth ID access idempotently.
- Add verification route/auth resume behavior and focused tests for token abuse, duplicate prevention, access migration, and route behavior.

## Constraints
- Store only invitation token hashes; never persist raw tokens.
- WorkOS AuthKit is the identity source of truth. Do not invent Convex session state and do not add a WorkOS `guest_lawyer` role.
- Invitation acceptance, identity resolution, LSO/IDV evidence, access migration, and downstream `LAWYER_VERIFIED` are separate facts.
- Successful verification must create immutable `lawyerVerifications` evidence before marking an invitation verified.
- Preserve the current provisional email access bridge until migration completes, then revoke or expire the fallback row.
- Do not emit `GUEST_LAWYER_VERIFIED`.

## Open questions
- Production email delivery is not configured in the issue context. Implementation will expose an internal/admin/dev retrieval path for generated invite URLs while keeping token storage production-safe.

## GitNexus Impact Notes
- `grantDealAccess`: LOW risk; direct callers in `convex/dealLocks/mutations.ts`, `convex/deals/mutations.ts`, and `convex/engine/effects/dealAccess.ts`.
- `canAccessDeal`: LOW risk; direct callers `canAccessTransferRequest` and `canAccessDocument`.
- `hasActiveDealAccess`: LOW risk; direct caller `canAccessDocument`.
- `requireActiveLawyerDeal`: LOW risk; one local direct caller in `convex/deals/lawyerMutations.ts`.
- `lawyerAccessPolicyForDeal`: LOW risk; one local direct caller in `convex/deals/lawyerQueries.ts`.
- `authMiddleware`: LOW risk for the queried symbol.
