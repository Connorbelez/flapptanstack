# Spec Audit: ENG-363 - Legal representation: enforce verification and engagement gates

- Audit skill: `$linear-pr-spec-audit`
- Review target: local branch diff in `/Users/connor/.codex/worktrees/7c70/fairlendapp`
- Last run: 2026-04-30T13:29:00-04:00
- Verdict: ready

## Findings
- none

## Unresolved items
- none for ENG-363 spec compliance.
- Validation caveat: full `bun run test` currently fails in unrelated baseline suites outside this change surface; ENG-363 targeted tests pass.

## Next action
- No ENG-363 implementation follow-up required.

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | backend gate | Add a deal-level legal gate helper evaluating selected lawyer, active access, current verification evidence, and signed engagement evidence. | `convex/legalRepresentation/gates.ts` | `evaluateDealLegalGate` resolves selected lawyer/auth, active lawyer access, profile eligibility, latest verification, and signed engagement. |
| SATISFIED | engagement evidence | Add a provider/manual-admin boundary for signed representation engagement evidence. | `convex/legalRepresentation/engagements.ts` | `recordSignedRepresentationEngagementRow` requires `lawyerAuthId` and `evidenceHash`, stores signed rows with provider default `manual_admin`. |
| SATISFIED | transition enforcement | `LAWYER_VERIFIED` cannot be emitted without eligible current verification evidence. | `convex/deals/mutations.ts:172` | Admin `transitionDeal` evaluates the legal gate before calling the transition engine and injects `verificationId` only after gate allow. |
| SATISFIED | transition enforcement | `REPRESENTATION_CONFIRMED` requires selected/authorized lawyer, active lawyer deal access, and signed engagement evidence. | `convex/deals/mutations.ts:177`, `convex/deals/lawyerMutations.ts:150` | Both admin and lawyer portal paths call the shared gate; lawyer portal passes acting auth id to reject mismatches. |
| SATISFIED | event contract | Keep existing event names and do not introduce stale legal statuses/events. | `rg LEGAL_CONFIRMED/GUEST_LAWYER_VERIFIED` | No forbidden event names were introduced by this branch; existing unrelated `awaiting_*` strings predate this issue and are outside legal representation status scope. |
| SATISFIED | workspace UX | Lawyer workspace exposes blocked/allowed confirmation state with evidence-specific reasons. | `convex/deals/lawyerQueries.ts:367`, `src/components/lawyer/deals/lawyerDealViewModel.ts:170` | Backend returns `representationGate.confirmation`; view model uses the backend gate message to disable confirmation while in `lawyerOnboarding.verified`. |
| SATISFIED | document blockers | Preserve existing `LAWYER_APPROVED_DOCUMENTS` package readiness blockers. | `convex/deals/lawyerMutations.ts` | Package approval blockers were left intact; tests still cover package blocker projection and approval path. |
| SATISFIED | guest/platform parity | Platform and guest lawyers use the same representation confirmation gate. | `convex/legalRepresentation/__tests__/gates.test.ts` | Added explicit guest-lawyer signed engagement allow coverage alongside selected/wrong lawyer coverage. |
| SATISFIED | tests | Prove deals cannot reach `documentReview.pending` without verified and confirmed representation evidence. | `convex/deals/__tests__/lawyerWorkspace.test.ts` | Admin missing verification and missing engagement paths reject; signed engagement success reaches `documentReview.pending`. |

## Coverage Summary
- SATISFIED: 9
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0
