# Chunk Context: chunk-03-backend-actions

## Goal
- Add lawyer-scoped mutations for representation confirmation and package approval through governed transition execution.

## Relevant plan excerpts
- `REPRESENTATION_CONFIRMED` and `LAWYER_APPROVED_DOCUMENTS` must go through the Transition Engine.
- Representation confirmation is only for active authorized lawyers in valid lifecycle state.
- Package approval is only for active authorized lawyers in valid lifecycle state and only after package generation exists, signatory mappings are complete, and pre-send exceptions are absent.
- Do not patch deal `status` directly.

## Implementation notes
- Use `lawyerMutation` for exported lawyer endpoints and explicit `.public()` or `.internal()`.
- Do not reuse admin-only `transitionDeal` UI/API as the lawyer action surface.
- Call the existing internal governed transition execution path after lawyer access and precondition checks.
- Include lawyer-source metadata so audit journal entries distinguish lawyer portal actions.
- Check ENG-342 exception state before approval. Missing ENG-342 contract should produce an explicit blocker or rejection rather than an unsafe approval.

## Existing code touchpoints
- Likely new file: `convex/deals/lawyerMutations.ts`.
- Existing: `convex/deals/mutations.ts`, `convex/engine/transition.ts` or equivalent internal transition helper, `convex/engine/machines/deal.machine.ts`, `convex/deals/envelopes.ts`, `convex/documents/dealPackages.ts`.

## GitNexus findings
- `transitionDeal`: LOW risk, no upstream callers in symbol graph. Admin UI uses generated API endpoint, so avoid changing the existing endpoint signature.
- `readDealDocumentPackageSurface` and `PackageSurface`: LOW risk and already checked for package surface consumption.

## Validation
- Convex mutation tests for valid representation confirmation, invalid state, unauthorized/revoked denial, valid package approval, missing package, incomplete signatory mapping, and open pre-send exception.
- `bunx convex codegen`.
- `bun check`.
- `bun typecheck`.
