# Execution Checklist: ENG-362 - Legal representation: implement guest invitations and WorkOS identity resolution

## Requirements From Linear
- [x] Create scoped guest lawyer invitation records when a deal has selectedLawyer.type = guest_lawyer and no resolved auth ID.
- [x] Store only a hash of the invitation token; never persist raw tokens.
- [x] Tokens are single-use, scoped to one invitation/deal, expiring, and invalidated on resend/change/swap.
- [x] Verification flow requires WorkOS sign-in/sign-up and canonical `lawyer` role/permission semantics.
- [x] Resolve existing lawyer profile by verified WorkOS auth ID, normalized email, and bar/jurisdiction evidence before provisioning a new one.
- [x] Do not create duplicate WorkOS identities for the same verified lawyer.
- [x] Migrate or supplement provisional email-based `guest_lawyer` dealAccess to resolved WorkOS auth ID access.
- [x] Preserve compatibility with current resource checks that can bridge by normalized email until migration completes.
- [x] On successful verification, create immutable lawyerVerifications evidence and mark invitation verified.
- [x] On permanent failure, leave the deal before document review and expose remediation data for ENG-364.

## Definition Of Done From Linear
- [x] Guest invitation records are scoped, expiring, single-use, and token-hash based.
- [x] WorkOS identity resolution/provisioning uses canonical `lawyer` role and avoids duplicates.
- [x] Provisional guest access can be migrated or supplemented to resolved auth ID access safely.
- [x] Existing private deal/document access behavior remains intact.
- [x] Tests cover success, retry, failure, and token abuse cases.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for token helpers, profile resolution, invitation lifecycle, and access migration.
- [x] Convex/backend tests added or updated for valid accept, expired/revoked/used/tampered token rejection, duplicate profile prevention, and restricted lawyer failure.
- [x] Route/integration tests added or updated for WorkOS auth-required verification route and fail-closed remediation state.
- [x] E2E coverage added or explicitly justified if full AuthKit verification cannot run locally.
  - Justification: the full AuthKit callback requires a live WorkOS browser login and hosted redirect state; local coverage is split across Convex lifecycle tests, auth/resource check regression tests, and route helper tests for redirect/fail-closed behavior.
- [x] Storybook coverage recorded as not applicable unless a reusable UI component is introduced.
  - Not applicable: the route uses local page-only shell markup and does not introduce a reusable component.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted tests passed.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
  - Verdict: needs manual validation for the live WorkOS AuthKit browser callback; no material local implementation blockers found.
