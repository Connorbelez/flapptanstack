# Spec Audit: ENG-364 - Legal representation: add lender and admin lawyer status controls

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against indexed base commit `9c8e508`
- Last run: 2026-04-30T14:03:43-04:00
- Verdict: ready

## Findings
- none

## Unresolved items
- none

## Requirement Ledger
- SATISFIED: legal representation status projection covers platform selected, guest invite sent/accepted/expired/revoked/failed/verified, restriction check, confirmation requested, confirmed, blocked, and not selected.
- SATISFIED: lender/admin views consume projected status instead of raw invitation/access records before `documentReview.pending`.
- SATISFIED: pending guest resend creates a fresh token delivery while preserving the existing expiry.
- SATISFIED: guest email change normalizes the target, revokes old invitation/access, creates new access/invitation, and audits old/new targets.
- SATISFIED: lawyer replacement before confirmation revokes old active lawyer access, revokes outstanding guest invitations, voids pending engagement evidence, stores the new selected lawyer, and audits affected references.
- SATISFIED: dealAccess rows are soft-revoked, not hard-deleted.
- SATISFIED: management mutations are server-authorized for FairLend admins or active lender deal access only.
- SATISFIED: controls rely on server-projected action availability and reject post-verification/post-document-review management.
- SATISFIED: deal lifecycle status is not mutated by these controls, preserving governed Transition Engine ownership.
- SATISFIED: tests cover success, denial, stale action, and duplicate-active cleanup/race-style replacement cases.

## Evidence
- Backend: `convex/legalRepresentation/status.ts`, `convex/legalRepresentation/management.ts`, `convex/legalRepresentation/invitations.ts`, `convex/deals/queries.ts`.
- UI: `src/components/legal-representation/LegalRepresentationStatusPanel.tsx`, lender workspace integration, admin operations integration.
- Tests: `convex/legalRepresentation/__tests__/management.test.ts`, updated invitation and route/component tests.
- Validation: `bunx convex codegen`; `bun check`; `bun typecheck`; targeted Vitest suite.

## Notes
- No PR URL exists in this worktree, so the audit target is the local branch diff.
- `bun check` exits 0 but still reports 114 existing repo warnings unrelated to this slice.
- Vitest exits 0 after assertions pass, then reports a process shutdown timeout.
