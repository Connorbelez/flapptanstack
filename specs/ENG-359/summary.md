# Summary: ENG-359 - Legal representation: establish lawyer compliance contracts

- Source issue: https://linear.app/fairlend/issue/ENG-359/legal-representation-establish-lawyer-compliance-contracts
- Primary plan: https://www.notion.so/313fc1b440248108a53ec4a4aeb6707c
- Supporting docs:
  - https://www.notion.so/313fc1b4402481b88b45c4c105745109
  - https://www.notion.so/313fc1b4402481e59483ec6db372777a
  - docs/architecture/rbac-and-permissions.md
  - docs/architecture/state-machines.md

## Scope
- Add legal compliance contract tables for LSO reference lawyers, FairLend lawyer profiles, verification evidence, guest invitations, and representation engagements adjacent to existing dealAccess.
- Extend checkout selected-lawyer validators/types so existing platform/manual guest snapshots remain valid while optional LSO metadata can be carried by downstream checkout work.
- Add typed legal-representation validators, provider interface, deterministic manual/test provider, normalization helpers, eligibility/currentness helpers, and read/write helpers for downstream issues.
- Add fixture builders for eligible platform lawyer, restricted LSO lawyer, new guest invite, returning guest lawyer, expired invitation, and signed engagement evidence.
- Add focused tests for snapshot compatibility, normalization, verification currentness/eligibility decisions, immutability semantics, and fixture contracts.
- Run Convex codegen and repository quality gates.

## Constraints
- WorkOS AuthKit remains source of truth; canonical WorkOS lawyer role stays `lawyer`.
- `platform_lawyer` and `guest_lawyer` remain FairLend dealAccess/domain roles only.
- Existing `dealAccess` schema, `grantedBy` string contract, and indexes by_user_and_deal, by_deal, and by_user must be preserved.
- LSO rows are reference/licensing records, not identity or auth records.
- Verification rows are immutable evidence; new facts create new rows except optional async completion fields for pending rows.
- The Transition Engine remains the only path that mutates deal status; do not add stale events such as `LEGAL_CONFIRMED`, `GUEST_LAWYER_VERIFIED`, or `awaiting_lawyer_onboarding`.
- Exported Convex functions must use fluent-convex builders with explicit `.public()` or `.internal()` visibility.
- No `any` unless unavoidable and documented at the use site.

## GitNexus Impact Summary
- `grantDealAccess`: LOW, 2 direct callers, no affected processes.
- `createDealAccess`: LOW, no indexed direct dependents.
- `canAccessDeal`: LOW, direct callers `canAccessTransferRequest` and `canAccessDocument`, Auth module affected.
- `dealMachine`: LOW, no indexed direct dependents.
- `selectedLawyerSnapshotValidator`, `parseSelectedLawyerSnapshot`, and `lawyerAccessPolicyForDeal` were not found as GitNexus targets; local `rg` call-site results are recorded in chunk context before edits.

## Open questions
- None blocking this foundational contract slice. Product questions about exact guest access bridge timing and where fresh restriction checks run are deferred to downstream issues; this issue provides typed helpers for those checkpoints.
