# Summary: ENG-363 - Legal representation: enforce verification and engagement gates

- Source issue: https://linear.app/fairlend/issue/ENG-363/legal-representation-enforce-verification-and-engagement-gates
- Primary plan: https://www.notion.so/350fc1b4402481739be8c7647098eeca
- Supporting docs:
  - https://www.notion.so/315fc1b4402481bbb3bcde38ca5960f6
  - docs/architecture/state-machines.md
  - https://www.notion.so/315fc1b4402481ab8337e91bd9402afa
  - https://www.notion.so/313fc1b4402481ee8655ffc5f039442e
  - https://www.notion.so/313fc1b44024812598bbe43b1c9acada

## Scope
- Enforce current legal representation gates on existing deal lifecycle events: `LAWYER_VERIFIED`, `REPRESENTATION_CONFIRMED`, and existing `LAWYER_APPROVED_DOCUMENTS` package blockers.
- Add shared legal gate helpers that evaluate selected lawyer identity, active authorized access, current eligible verification evidence, and signed representation engagement evidence.
- Add/read representation engagement evidence through an explicit provider/manual-admin boundary; no silent UI-only acknowledgement may satisfy the gate.
- Surface evidence-specific blocked/allowed states in the lawyer workspace.
- Add backend and view-model tests proving blocked and successful paths.

## Constraints
- The Transition Engine remains the only path that mutates `deal.status`.
- Do not introduce `LEGAL_CONFIRMED`, `GUEST_LAWYER_VERIFIED`, or `awaiting_*` statuses.
- Backend gates are authoritative; UI disabled state is advisory only.
- Platform and guest lawyers must share the same confirmation gate.
- Rejections need non-sensitive operational reason codes in existing transition/audit surfaces.
- Preserve private document/deal access checks and existing document approval blockers.

## Existing Context
- `convex/legalRepresentation/verifications.ts` already contains verification currentness helpers and `decideLegalCheckpoint`, but no deal-level gate helper that resolves selected lawyer/access/engagement rows.
- `convex/schema.ts` already has `lawyerVerifications`, `lawyerProfiles`, `lawyerInvitations`, `representationEngagements`, and `dealAccess`.
- `convex/deals/lawyerMutations.ts` currently gates `confirmRepresentation` on active lawyer access and `lawyerOnboarding.verified`, but not signed engagement evidence.
- `convex/deals/lawyerQueries.ts` currently returns workspace/package state, but not representation gate state.
- `src/components/lawyer/deals/lawyerDealViewModel.ts` disables confirmation only by read-only/status state.

## Open Questions
- Documenso engagement signing is not confirmed as ready in this environment. Implement a provider boundary plus audited `manual_admin` evidence path and consume the same evidence contract.
