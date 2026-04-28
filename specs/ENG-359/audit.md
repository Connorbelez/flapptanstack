# Spec Audit: ENG-359 - Legal representation: establish lawyer compliance contracts

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff in `/Users/connor/.codex/worktrees/7a77/fairlendapp`
- Last run: 2026-04-28T20:07:44Z
- Verdict: ready

## Findings
- none

## Unresolved items
- none for ENG-359 spec compliance.
- Validation caveat: `bun run test` still exits 1 because of failures outside this issue's legal-representation scope; see `specs/ENG-359/status.md`.

## Next action
- ENG-359 is ready for review once the unrelated full-suite blockers are handled or accepted by the human owner.

## Post-Review Fixes

- Addressed checkout replay/idempotency comparison for selected-lawyer LSO metadata.
- Addressed suspended LSO restriction classification.
- Addressed normalized verification lookup writes.
- Addressed latest verification helpers to use indexed descending `first()` reads.
- Added `listExpiringLawyerVerifications` for expiry sweeps.
- Enforced expiry on eligible verification evidence.

## Requirement Ledger

| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | schema | Add legal compliance tables adjacent to existing `dealAccess`. | `convex/schema.ts` defines `lsoLawyers`, `lawyerProfiles`, `lawyerVerifications`, `lawyerInvitations`, and `representationEngagements` before the unchanged `dealAccess` table. | Tables do not replace `dealAccess`. |
| SATISFIED | schema | Keep `dealAccess.grantedBy` as string and preserve existing indexes. | `convex/schema.ts` keeps `grantedBy: v.string()` and indexes `by_user_and_deal`, `by_deal`, and `by_user`. | Existing deal access contract remains intact. |
| SATISFIED | auth/RBAC | Preserve WorkOS canonical `lawyer`; do not introduce WorkOS `platform_lawyer` or `guest_lawyer`. | No WorkOS role catalog changes in this diff; new docs explicitly preserve `lawyer` as canonical. | `platform_lawyer` and `guest_lawyer` remain FairLend domain roles only. |
| SATISFIED | selected lawyer | Allow optional LSO metadata in checkout selected-lawyer snapshots without breaking current platform/manual guest snapshots. | `convex/checkout/validators.ts`; tests in `convex/checkout/__tests__/validators.test.ts`. | Legacy snapshots remain covered. |
| SATISFIED | verification evidence | Verification evidence is immutable and queryable by deal, profile/auth ID, check type, bar/jurisdiction, and expiry/currentness. | `convex/legalRepresentation/verifications.ts`; schema indexes in `convex/schema.ts`; contract tests in `convex/legalRepresentation/__tests__/contracts.test.ts`. | Only pending provider rows may receive provider completion fields. |
| SATISFIED | checkpoints | Provide helper decisions for selection, `LAWYER_VERIFIED`, `REPRESENTATION_CONFIRMED`, and platform activation. | `decideLegalCheckpoint` and `verificationBlocksCheckpoint` in `convex/legalRepresentation/verifications.ts`. | Tests cover allow, block, stale evidence, signed engagement, and suspended profile decisions. |
| SATISFIED | fixtures | Provide typed fixture builders for downstream tests/seeds. | `convex/legalRepresentation/fixtures.ts`; exercised in contract tests. | Covers eligible platform lawyer, restricted LSO lawyer, new/expired invitations, returning guest, and signed engagement evidence. |
| SATISFIED | generated types | Generate Convex API/types. | `bunx convex codegen` passed and `convex/_generated/api.d.ts` changed. | Legal representation modules are present in generated API typing. |
| SATISFIED | docs | Document helper imports and table contracts for downstream issues. | `docs/architecture/legal-representation-contracts.md`. | Includes boundaries, tables, helper modules, checkpoints, and snapshot guidance. |
| SATISFIED | tests | Cover eligibility/currentness and compatibility. | Targeted Vitest command passed for checkout validators, legal representation contracts, and existing dealAccess tests. | Full-suite unrelated blockers are recorded separately. |
