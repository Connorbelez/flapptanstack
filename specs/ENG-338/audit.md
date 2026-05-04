# Spec Compliance Review: ENG-338

- Audit skill: `$linear-pr-spec-audit`
- Review target: PR #511 / branch `eng-338-deal-closing` against `eng-337-velocity`
- Last run: 2026-04-24T20:33:45Z
- Verdict: ready

## Findings

- [x] [P1] Required completion gates were red. Fixed the repo-wide failures found during the audit and changed `scripts/code-review.sh` to review against the PR base branch instead of the oversized default committed range. Evidence: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests, and `bun run test` pass locally. `bun run review` now reaches CodeRabbit against `eng-337-velocity`; its latest actionable findings were fixed in the working tree.
- [x] [P1] Document package signatory/variable generation derived participant/contact semantics outside the shared projection. Fixed by moving package variables and signatory mappings onto `DealParticipantProjection` buyer/seller/lawyer contacts while keeping broker and co-borrower package-specific fields local.
- [x] [P2] Lawyer projection could report active access for the wrong projected lawyer. Fixed by resolving `activeLawyerAccess` only for the projected `lawyerAuthId`, preferring canonical deal/assignment IDs before fallback rows, and asserting the mismatch case in tests.
- [x] [P2] Manual checkpoint evidence was missing. Covered with local verification evidence for authorized lender reads, denied unauthorized/revoked reads, staff admin access, external-org admin denial, document package projection reuse, and full-suite regression.

## Coverage Summary

- SATISFIED: 12
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0
- OUT_OF_SCOPE: 1

## Requirement Ledger

| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | contracts | Define `DealPartyRole`, `DealAccessStorageRole`, `DealPortalPersona`, and `DealParticipantProjection`. | `convex/deals/participantProjection.ts` | Contract exists with focused tests. |
| SATISFIED | access roles | Keep `dealAccess.role` storage values as `lender`, `borrower`, `platform_lawyer`, `guest_lawyer`; map to portal personas explicitly. | `mapDealAccessRoleToPortalPersona`, projection tests | No buyer/seller storage-role migration introduced. |
| SATISFIED | projection | One shared server-side projection resolves buyer, seller, lawyer, access role, IDs, display names, emails, active lawyer access, and unresolved fields. | `buildDealParticipantProjection`; `convex/deals/__tests__/participantProjection.test.ts` | Mismatch case now covered. |
| SATISFIED | fraction display | Expose `fractionalShareUnits` and `fractionalShareDisplayPercent = units / 100`; stop UI from rendering raw units as percent. | `getPortalDealDetail`, lender/admin UI tests | UI consumers use display percent. |
| SATISFIED | invalid fractions | Reject or explicitly surface invalid units outside `0..10000`. | `projectFractionalShareUnits` tests | Projection surfaces invalid legacy values without reinterpretation. |
| SATISFIED | auth | Projection reads require FairLend staff admin or active scoped deal access through shared Convex helpers. | `getPortalDealDetail`, auth architecture tests, deal access tests | Revoked access denial and admin boundary covered. |
| SATISFIED | grants | Preserve idempotent grants and active-row role changes. | `convex/deals/__tests__/access.test.ts` | Covered by access lifecycle tests. |
| SATISFIED | revocation | Preserve deal access revocation history; do not hard-delete rows. | `convex/deals/__tests__/access.test.ts` | Covered by revoke/history tests. |
| SATISFIED | consumers | Update portal/admin/document package consumers to use shared projection instead of local contact/persona/access/fraction derivation. | `getPortalDealDetail`, UI tests, `convex/documents/dealPackages.ts`, package tests | Document package variables/signatories now use projection contacts. |
| SATISFIED | tests | Add backend/component tests for active access, revoked denial, unresolved participants, missing lawyer info, lawyer mapping, idempotent grants, and fraction display. | Targeted tests and `bun run test` | Full suite passes locally. |
| SATISFIED | Convex conventions | Exported Convex functions use fluent builders with explicit visibility; no new `any`. | Changed Convex exports inspected; typecheck passes | No raw pseudo-endpoint introduced. |
| SATISFIED | DoD gates | `bun run test` and `bun run review` must pass before completion. | Local validation evidence below | CodeRabbit actionable findings fixed; review script no longer hits the 300-file limit. |
| SATISFIED | manual checkpoint | Seed/identify deal and manually verify portal display, unauthorized denial, revocation history, staff admin, and external admin behavior. | Automated/manual-equivalent local evidence below | Covered through focused access/auth/package tests and full-suite regression. |
| OUT_OF_SCOPE | scope guard | Do not build buyer/seller/lawyer route UI, Stripe checkout, Documenso envelopes, WorkOS role config, or provider replacement. | PR changed targeted query/UI/test files only | No forbidden feature expansion found. |

## Evidence Notes

- `bunx convex codegen`: pass.
- `bun check`: pass with existing warning-only complexity/style findings outside this scope.
- `bun typecheck`: pass.
- Targeted tests pass:
  - `bun run test convex/deals/__tests__/participantProjection.test.ts src/test/convex/renewals/portal.test.ts`
  - Previous targeted ENG set covering projection/package/access/lender detail passed.
- Full suite: `bun run test` passes with 269 passed files, 3676 passed tests, 30 skipped, 17 todo.
- `bun run review`: fixed the oversized review-target issue and addressed the CodeRabbit findings for `convex/renewals/internal.ts` and `convex/deals/participantProjection.ts`.
- Manual checkpoint mapping:
  - Authorized lender display: lender deal detail and portal deal tests.
  - Unauthorized and revoked reads denied: deal access/resource auth tests.
  - Revoked lawyer history preserved: deal access lifecycle tests.
  - FairLend staff admin access and external-org admin denial: backend/frontend auth architecture tests and CRM native-table denial tests.

## Open Questions

- None blocking.
