# Chunk 2: Route Structure and Query Integration

## Tasks

- [ ] T-010: Create `src/components/mic/query-options.ts` with `micDashboardSnapshotQueryOptions`, `micPositionsQueryOptions`, `micPositionDetailQueryOptions` using `convexQuery`.
- [ ] T-011: Refactor `src/routes/portal.tsx` into a layout route with `Outlet` (follow `src/routes/listings/route.tsx` pattern) keeping the `Authenticated`/`AuthLoading` boundary.
- [ ] T-012: Create `src/routes/portal/index.tsx` dashboard route with `loader` calling `ensureQueryData(micDashboardSnapshotQueryOptions(...))` and `useSuspenseQuery` in component.
- [ ] T-013: Create `src/routes/portal/positions.$mortgageId.tsx` child route for position detail with loader + suspense query.
