# Execution Checklist: ENG-359 - Legal representation: establish lawyer compliance contracts

## Requirements From Linear
- [x] Add the legal compliance tables adjacent to, not instead of, the existing dealAccess table.
- [x] Preserve WorkOS canonical role `lawyer`; do not add WorkOS roles named `platform_lawyer` or `guest_lawyer`.
- [x] Keep `platform_lawyer` and `guest_lawyer` as FairLend dealAccess/domain roles.
- [x] Keep `dealAccess.grantedBy` as a string and preserve existing indexes by_user_and_deal, by_deal, and by_user.
- [x] Add validators/types that allow downstream checkout selectedLawyer snapshots to carry optional LSO metadata without breaking current platform/manual guest snapshots.
- [x] Make verification evidence immutable and queryable by deal, lawyer profile/auth ID, check type, and expiry/currentness.
- [x] Provide explicit helper functions to decide whether a verification blocks selection, LAWYER_VERIFIED, REPRESENTATION_CONFIRMED, or platform activation.
- [x] Provide fixture builders for eligible platform lawyer, restricted LSO lawyer, new guest lawyer invite, returning guest lawyer, expired invitation, and signed engagement evidence.
- [x] Update generated Convex API/types with bunx convex codegen.

## Definition Of Done From Linear
- [x] New legal compliance contract tables and validators exist and are generated into Convex types.
- [x] Existing checkout selectedLawyer behavior still accepts current platform and manual guest snapshots.
- [x] Downstream issues can import typed helpers instead of duplicating local schema assumptions.
- [x] Tests cover eligibility/currentness decisions and contract compatibility.
- [x] No WorkOS platform_lawyer or guest_lawyer role is introduced.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added for normalization helpers, selectedLawyer snapshot compatibility, verification currentness/eligibility helpers, provider failure behavior, and fixture builders.
- [x] Convex/backend contract tests added or updated for immutable verification rows and queryability by deal/profile/auth/bar/check/expiry where feasible.
- [x] E2E tests explicitly justified as not applicable because this issue is backend/schema contract work with no operator or user UI workflow.
- [x] Storybook stories explicitly justified as not applicable because this issue does not introduce or change reusable UI components.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed after code changes.
- [x] `bun typecheck` passed.
- [x] Targeted legalRepresentation/checkout/dealAccess tests passed.
- [x] `bun run test` passed or any blocker is explicitly recorded.
  - Blocker recorded: full-suite failures remain outside ENG-359 scope in mortgage blueprint mappings, cash ledger regression verification, and Velocity activation/mock tests.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
