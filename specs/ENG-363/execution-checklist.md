# Execution Checklist: ENG-363 - Legal representation: enforce verification and engagement gates

## Requirements From Linear
- [x] Add a legal gate helper that evaluates selected lawyer, active access, fresh verification evidence, and representation engagement evidence for a deal.
- [x] Ensure `LAWYER_VERIFIED` cannot be emitted for a lawyer with missing/stale/ineligible verification evidence.
- [x] Ensure `REPRESENTATION_CONFIRMED` cannot transition a deal unless the acting lawyer is the selected/authorized lawyer and engagement evidence exists.
- [x] Keep platform and guest lawyers on the same confirmation gate.
- [x] Keep current event names: `LAWYER_VERIFIED`, `REPRESENTATION_CONFIRMED`, `LAWYER_APPROVED_DOCUMENTS`.
- [x] Do not introduce `LEGAL_CONFIRMED`, `GUEST_LAWYER_VERIFIED`, or `awaiting_*` statuses.
- [x] Journal rejection reasons through existing transition/audit surfaces with operationally useful but non-sensitive reason codes.
- [x] Update lawyer workspace actions so confirmation is disabled or blocked with clear reasons until evidence preconditions are satisfied.
- [x] Preserve existing document approval package readiness blockers.

## Definition Of Done From Linear
- [x] `LAWYER_VERIFIED` and `REPRESENTATION_CONFIRMED` enforce the target evidence gates.
- [x] Platform and guest lawyers share the same representation confirmation path.
- [x] No stale state/event names are introduced.
- [x] Lawyer workspace clearly exposes blocked/allowed confirmation states.
- [x] Tests prove deals cannot reach `documentReview.pending` without verified and confirmed representation evidence.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for legal gate helper and engagement evidence behavior.
- [x] Backend/Convex tests added or updated for `LAWYER_VERIFIED`, `REPRESENTATION_CONFIRMED`, admin/manual bypass prevention, and package approval regression.
- [x] Lawyer workspace view-model/component tests updated for evidence-specific blocked/allowed states.
- [x] E2E tests added or explicitly justified as not appropriate for this backend/workspace slice.
  - Justification: authoritative behavior is Convex/backend gating plus existing lawyer workspace component state; no new route flow or browser-only workflow was introduced.
- [x] Storybook stories added or explicitly justified as not appropriate for this non-reusable screen state change.
  - Justification: this changes backend-projected state and existing page action state, not a reusable isolated component contract.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted legalRepresentation gate tests passed.
- [x] Targeted lawyer workspace tests passed.
- [x] Targeted engine/transition tests passed or were covered by targeted backend transition tests.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
