# Chunk Context: chunk-01-route-seam

## Goal
- Deliver the additive route-owned seam: validated search state, shared React query helpers over the existing portfolio Convex endpoints, and the new `/lender/portfolio` route file with portal-aware prefetching and suspense-safe auth gating.

## Relevant plan excerpts
- "This issue owns: `src/routes/lender.portfolio.tsx`, the shared portfolio route-query consumer seam, and the baseline `/lender/portfolio` route test."
- "Repo seams to ground the implementation: `src/routes/lender/route.tsx` remains the lender boundary, `src/routes/__root.tsx` remains the source of portalContext, and `src/components/listings/portal-query-options.ts` is the pattern to follow when creating the shared consumer seam for the route."
- Requirement 2 from Linear: own the shared portfolio route/query orchestration seam so downstream issues consume one route-level data boundary instead of inventing competing query modules.

## Implementation notes
- Keep the implementation additive: create a new route file and new lender-portfolio helpers instead of editing existing listing or lender route modules unless a later blocker makes that unavoidable.
- Use `assertActivePortalId` against `RootRoute.useRouteContext().portalContext` for both the route loader and the rendered route component.
- Because the new route will use `useSuspenseQuery`, wrap the route's suspense body with `Authenticated` / `AuthLoading` so the subscription does not mount before the Convex auth wrapper is ready.
- Store filter, sort, and selected-detail state in validated route search params so the shell and detail hosts share a single orchestration seam.

## Existing code touchpoints
- `src/routes/listings/index.tsx`: loader + `validateSearch` + `useSuspenseQuery` route pattern.
- `src/components/listings/query-options.ts` and `src/components/listings/portal-query-options.ts`: existing `convexQuery(...)` consumer seam pattern.
- `src/routes/__root.tsx` and `src/lib/portal/active-portal.ts`: root portal context and `portalId` assertion path.
- GitNexus context on `marketplaceListingsQueryOptions` shows the route layer consumes the shared query-option helper instead of re-deriving API call shapes in the component.
- No existing-symbol edits are planned in this chunk at ready-to-edit time.

## Validation
- `src/test/routes/lender-portfolio-route.test.tsx` should prove the route loader and rendered route both consume the shared portfolio query-option seam.
- `bun typecheck` must pass with the new route search-state and query-option types.
