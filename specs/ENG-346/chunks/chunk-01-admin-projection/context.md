# Chunk Context: chunk-01-admin-projection

## Goal
- Add the server projection and pure view-model layer that all admin operations UI consumes.

## Relevant plan excerpts
- "Add or extend an admin deal operations projection in Convex that composes normalized participant/access/fraction, envelope/signing, funds/archive/close-effect, blocker, and audit timeline data."
- "Do not invent local lifecycle states in UI; derive from server projections and the deal machine contract."
- "If ENG-342/343 are not implemented yet, do not invent their schemas in UI." Current worktree has those modules implemented, so consume them.

## Implementation notes
- Current `convex/deals/queries.ts` already imports participant, envelope, and close evidence helpers.
- Add a new admin operations query instead of overloading participant workspace queries.
- Use `adminQuery.public()` for staff admin gating.
- Create frontend helper functions that accept typed projection rows; keep React components thin.
- Missing optional package/signing/evidence/access data should become explicit blocker or unavailable rows.

## Existing code touchpoints
- `convex/deals/queries.ts`: `getDealsByPhase`, `readCloseEvidenceProjection`, package/signing helpers, participant projection imports.
- `convex/deals/participantProjection.ts`: ENG-338 participant/fraction contract.
- `convex/deals/envelopes.ts`: ENG-342 signing status/completion helpers.
- `convex/deals/closeEvidence.ts`: ENG-343 funds/archive/effect projections.
- `src/components/admin/deals/dealOperationsViewModel.ts`: new pure helper module.
- GitNexus impact: `getDealsByPhase` LOW; `activeDealAccessRecords` LOW.

## Validation
- Targeted unit tests for `dealOperationsViewModel`.
- Targeted Convex projection tests or existing query tests updated.
- `python3 scripts/validate_execution_artifacts.py ENG-346 --repo-root "/Users/connor/.codex/worktrees/bd5d/nt1n" --stage ready-to-edit` before edits.
