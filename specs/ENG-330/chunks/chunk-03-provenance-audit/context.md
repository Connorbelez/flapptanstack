# Chunk Context: chunk-03-provenance-audit

## Goal
- Add Velocity workflow provenance and package audit helper contracts without changing the shared audit journal core.

## Relevant plan excerpts
- Recommended provenance constants: `creationSource: velocity_package`, `originationPath: velocity`, `workflowSourceType: velocity_package`, `workflowSourceKey: velocity_package:mortgage:<linkApplicationId>`.
- Package lifecycle events must write through the repo's existing append-only audit pipeline.
- Package audit payloads must preserve webhook agent identity and connector credential scope.

## Implementation notes
- Mirror the shape of `convex/mortgages/provenance.ts` for source builders.
- Wrap `appendAuditJournalEntry` from `convex/engine/auditJournal.ts`; do not modify its core normalization or hash-chain behavior.
- Keep package audit categories and payload contracts explicit so downstream writers do not invent ad hoc strings.

## Existing code touchpoints
- New files under `convex/velocity/` are expected.
- `convex/engine/auditJournal.ts` is a dependency and should not be edited for this slice.
- `convex/mortgages/provenance.ts` is a reference pattern and should not be edited for this slice.
- `convex/engine/validators.ts` and `convex/engine/types.ts` need an additive `velocityPackageWorkspace` entity type for first-class package audit rows.
- GitNexus impact for `entityTypeValidator`: LOW risk, 0 direct dependents.
- GitNexus impact for `appendAuditJournalEntry`: CRITICAL if changed; this slice will not modify it.

## Validation
- Targeted Velocity tests.
- `bun typecheck`
