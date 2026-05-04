# Execution Status: ENG-348 - Deal closing: ship buyer and seller workspaces

- Overall status: blocked
- Current phase: validation-audit
- Current chunk: chunk-03-tests-validation-audit
- Last updated: 2026-04-25T16:54:01Z

## Active focus
- Complete spec audit and resolve validation blockers.

## Blockers
- `bunx convex dev --once` cannot deploy current functions because the dev deployment contains an existing `portals.portalType = "mic"` row that violates the checked-in schema union (`fairlend | broker`). This blocks browser e2e verification of the new Convex queries against the dev deployment.
- `bun run test` still fails in unrelated `convex/demo/__tests__/ampsE2e.test.ts` expectations (`dispersal_ready` vs `outbound_pending_confirmation`, payout created count `0` vs `1`).

## Notes
- Linear issue and Notion plan are available and aligned.
- Supporting docs confirm WorkOS plus Convex authorization, document engine scope boundaries, and governed transition constraints.
- GitNexus indexed this worktree successfully after initial `Repository not indexed` status.
- Ready-to-edit artifact validation passed.
- GitNexus impact was LOW for `getPortalDealDetail`, `assertDealAccess`, `readDealDocumentPackageSurface`, `listEnvelopeProjection`, `LenderDealDetailPage`, `activeDealAccessRecords`, and `PackageSurface`.
- GitNexus impact was HIGH for `buildDealParticipantProjection`; avoid editing that helper unless necessary because direct dependents include `convex/deals/queries.ts`, `convex/documents/dealPackages.ts`, and `convex/deals/envelopes.ts`.
- Chunk 1 added `getParticipantDealQueue` and `getParticipantDealWorkspace`, plus focused Convex projection tests.
- `bunx convex codegen`, `bun typecheck`, and `bun test convex/deals/__tests__/participantWorkspace.test.ts` passed after installing lockfile dependencies.
- Chunk 2 added shared participant queue/workspace UI, lender and borrower route entry points, authenticated route wrappers, and route/component coverage.
- Targeted validation passed: `bunx convex codegen`, `bun check`, `bun typecheck`, and `bun run test src/test/auth/backend-auth-architecture.test.ts src/test/deals/participant-workspace.test.tsx convex/deals/__tests__/participantWorkspace.test.ts`.
