# Chunk Context: chunk-02-backend-projections

## Goal
- Add lawyer-scoped Convex projections for assigned closings and deal workspace detail while enforcing server-side lawyer access.

## Relevant plan excerpts
- Authorization must be server-side. Client-side filtering cannot be the access boundary.
- Lawyer assigned closings must list only active scoped lawyer access or valid platform lawyer assignment.
- Workspace panels must be backed by server projections: Matter Overview, Package Review, Signers & Order, Timeline.
- Matter Overview consumes ENG-338 participant/access/fraction fields.
- Package Review and Signers & Order consume ENG-342 envelope/pre-send exception and recipient progress contracts.

## Implementation notes
- Use `lawyerQuery` from `convex/fluent.ts` for exported lawyer endpoints and end exports with `.public()` or `.internal()`.
- Do not use generic `canAccessDeal` alone for lawyer workspace authorization.
- Prefer `convex/deals/participantProjection.ts` for ENG-338 participant/fraction display semantics.
- Prefer `convex/deals/envelopes.ts` projection helpers for ENG-342 attempt/recipient/exception/reissue state where available.
- Use `readDealDocumentPackageSurface` for generated package state; do not treat signable placeholders as live artifacts.
- Implement historical completed/read-only policy explicitly; do not weaken active `assertDealAccess`.

## Existing code touchpoints
- Likely new file: `convex/deals/lawyerQueries.ts`.
- Existing: `convex/deals/queries.ts`, `convex/deals/participantProjection.ts`, `convex/deals/envelopes.ts`, `convex/documents/dealPackages.ts`, `convex/auth/resourceChecks.ts`, `convex/authz/resourceAccess.ts`.
- Tests: `convex/deals/__tests__/lawyerWorkspace.test.ts` or matching existing Convex test location.

## GitNexus findings
- `assertDealAccess`: LOW risk, direct callers in `dealPackages.ts`, `deals/queries.ts`, `deals/envelopes.ts`, and transfer queries.
- `canAccessDeal`: LOW risk, direct dependents `canAccessTransferRequest` and `canAccessDocument`.
- `getPortalDealDetail`: LOW risk, no upstream callers in the index.
- `readDealDocumentPackageSurface`: LOW risk, direct consumers `deals/queries.ts` and `crm/detailContextQueries.ts`.
- `PackageSurface`: LOW risk, direct consumers `deals/queries.ts` and `crm/detailContextQueries.ts`.

## Validation
- Targeted Convex tests for lawyer list/detail projections.
- `bunx convex codegen` if exported API changes.
- `bun check`.
- `bun typecheck`.
