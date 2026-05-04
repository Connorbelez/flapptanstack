# Chunk 2 Context: Route Structure and Query Integration

## Goal
Set up the TanStack Query options and route structure for the MIC portal dashboard, following the canonical listings pattern.

## Existing Patterns to Follow

### Listings Pattern (Canonical Reference)
`src/routes/listings/route.tsx` — layout route:
```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { guardRouteAccess } from "#/lib/auth";

export const Route = createFileRoute("/listings")({
  beforeLoad: guardRouteAccess("listings"),
  component: ListingsLayout,
});

export function ListingsLayout() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
      <Authenticated>
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
      </Authenticated>
      <AuthLoading>
        <AppRoutePendingScreen />
      </AuthLoading>
    </div>
  );
}
```

`src/routes/listings/index.tsx` — index route with loader:
```tsx
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { marketplaceListingsQueryOptions } from "#/components/listings/query-options";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import { Route as RootRoute } from "../__root";

export const Route = createFileRoute("/listings/")({
  component: ListingsIndexRoutePage,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps: { search } }) => {
    const portalId = assertActivePortalId(
      context.portalContext,
      "Marketplace listings require an active portal host."
    );
    await context.queryClient.ensureQueryData(
      marketplaceListingsQueryOptions(portalId, search)
    );
  },
  validateSearch: (search: Record<string, unknown>) =>
    parseMarketplaceListingsSearch(search),
});

export function ListingsIndexRoutePage() {
  const search = Route.useSearch();
  const { portalContext } = RootRoute.useRouteContext();
  const portalId = assertActivePortalId(
    portalContext,
    "Marketplace listings require an active portal host."
  );
  const { data } = useSuspenseQuery(
    marketplaceListingsQueryOptions(portalId, search)
  );
  // ... render component
}
```

### Query Options Pattern
`src/components/listings/query-options.ts`:
```tsx
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function marketplaceListingsQueryOptions(
  portalId: Id<"portals">,
  search: MarketplaceListingsSearchState
) {
  return convexQuery(api.listings.marketplace.listMarketplaceListings, {
    portalId,
    // ... other args
  });
}
```

### Current Portal Route
`src/routes/portal.tsx`:
```tsx
export const Route = createFileRoute("/portal")({
  beforeLoad: guardRouteAccess("micPortal"),
  component: MicPortalRouteComponent,
});

export function MicPortalRouteComponent() {
  return (
    <>
      <Authenticated>
        <MicPortalProtectedShell />
      </Authenticated>
      <AuthLoading>
        <AppRoutePendingScreen />
      </AuthLoading>
    </>
  );
}
```

## What to Build

### 1. Query Options (`src/components/mic/query-options.ts`)
Create query option helpers for:
- `micDashboardSnapshotQueryOptions(portalId)` → `api.micPortfolio.getMicDashboardSnapshot`
- `micPositionsQueryOptions(portalId, filters?)` → `api.micPortfolio.getMicPositions`
- `micPositionDetailQueryOptions(portalId, mortgageId)` → `api.micPortfolio.getMicPositionDetail`
- `micPaymentsHistoryQueryOptions(portalId, mortgageId?)` → `api.micPortfolio.getMicPaymentsHistory`
- `micConcentrationExposureQueryOptions(portalId)` → `api.micPortfolio.getMicConcentrationExposure`

All take `portalId: Id<"portals">`.

### 2. Refactor `/portal` to Layout Route
Convert `src/routes/portal.tsx` to use `Outlet` (like listings). The auth boundary stays the same.

### 3. Create `/portal/` Index Route
`src/routes/portal/index.tsx`:
- Loader with `ensureQueryData(micDashboardSnapshotQueryOptions(portalId))`
- Component uses `useSuspenseQuery` with same options
- Renders dashboard layout with metrics, positions, concentration, maturity

### 4. Create `/portal/positions/$mortgageId` Route
`src/routes/portal/positions.$mortgageId.tsx`:
- Loader with `ensureQueryData(micPositionDetailQueryOptions(portalId, mortgageId))`
- Component uses `useSuspenseQuery`
- Renders full position detail page

### Route Tree Regeneration
After adding new route files, run `bunx convex codegen` (which may also regenerate the route tree, or it happens automatically via TanStack Router's Vite plugin).

### Portal ID Access
```tsx
const portalId = assertActivePortalId(
  portalContext,
  "MIC portal requires an active portal host."
);
```

### MIC Portfolio API Surface
```
api.micPortfolio.getMicDashboardSnapshot
api.micPortfolio.getMicPositions
api.micPortfolio.getMicPositionDetail
api.micPortfolio.getMicPaymentsHistory
api.micPortfolio.getMicConcentrationExposure
```

### Auth Boundary Notes
- The layout route keeps `beforeLoad: guardRouteAccess("micPortal")`
- `guardRouteAccess("micPortal")` checks for `mic:access` permission
- The `Authenticated`/`AuthLoading` wrapper prevents suspense queries from mounting before Convex auth is ready
