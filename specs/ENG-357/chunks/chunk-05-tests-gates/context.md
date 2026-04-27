# Chunk 5 Context: Tests and Quality Gates

## Goal
Write frontend tests for the MIC landing page and dashboard, then run all quality gates.

## Test Patterns to Follow

### Existing Route Test
`src/test/routes/mic-portal-route.test.tsx`:
```tsx
import { describe, expect, it } from "vitest";
import { renderRoute } from "../renderRoute";

describe("MIC portal route", () => {
  it("redirects signed-out visitors to /sign-in with redirect=/portal", async () => {
    const screen = renderRoute({ path: "/portal" });
    // ... assertions
  });
  // ... more tests
});
```

### Existing Admin Registry Test
`src/test/admin/mic-investor-access-registry.test.ts`:
Uses `convex-test` patterns for backend testing.

### Component Testing Pattern
Use `@testing-library/react` with `render`, `screen`, `fireEvent`, `waitFor`.
Use `vi.fn()` from `vitest` for mocks.

## Test Specifications

### Landing Page Tests (`src/test/mic/landing-page.test.tsx`)
1. **Renders MIC landing page** — Given a MIC portal context, renders the landing page with heading, description, email form, and sign-in button.
2. **Email form submission** — Typing a valid email and clicking submit calls the mutation with the email and portalId. Shows loading state during submission.
3. **Generic success state** — After successful submission, shows generic success message. The same message appears for duplicate submissions.
4. **Invalid email handling** — Submitting an invalid email shows local validation error (or lets server error surface).
5. **Sign-in CTA href** — The sign-in button links to `/sign-in?redirect=/portal`.
6. **Non-MIC portal** — When portalType is not "mic", does NOT render the MIC landing page.

### Dashboard Tests (`src/test/mic/dashboard.test.tsx`)
1. **Renders dashboard metrics** — Given mock snapshot data, renders all 6 metric cards with correct formatted values.
2. **Renders positions table** — Given mock positions, renders the table with correct rows and columns.
3. **Row click opens drawer** — Clicking a position row calls the row-click handler / opens the detail drawer.
4. **Warnings banner** — When `dataCompleteness === "partial"`, renders the warnings banner with backend warning messages.
5. **Empty state** — When positions array is empty, renders "No active MIC positions found" message.
6. **Concentration section** — Renders concentration breakdowns with correct data.
7. **Maturity ladder** — Renders maturity buckets with correct labels and values.

### Portal Route Tests (`src/test/mic/portal-routes.test.tsx`)
1. **`/portal` loader** — Loader calls `ensureQueryData` with correct query options and portalId.
2. **`/portal/positions/$mortgageId` loader** — Loader calls `ensureQueryData` with correct position detail options.
3. **Auth boundary** — Route still requires `mic:access` permission.

## Mock Data
Create realistic mock data matching the contract types:
```tsx
const mockMetrics: MicPortfolioMetrics = {
  activePositionCount: 3,
  arrearsExposure: 0,
  delinquencyExposure: 0,
  outstandingPrincipal: 1500000,
  weightedAverageLtv: 72.5,
  weightedAverageYield: 8.25,
};

const mockPosition: MicPositionRow = {
  arrearsSignal: { overdueAmount: 0, overdueCount: 0, status: "current" },
  borrowerLabel: "Test Borrower",
  drilldownIds: { listingId: "listing_123", mortgageId: "mortgage_123", positionAccountId: "pos_123", propertyId: "prop_123" },
  ltv: 70,
  maturityDate: "2027-06-15",
  mortgageId: "mortgage_123",
  outstandingPrincipal: 500000,
  positionAccountId: "pos_123",
  positionUnits: 250000,
  principal: 600000,
  propertyLabel: "123 Main St, Toronto",
  propertySummary: { city: "Toronto", propertyType: "Single Family", province: "ON", streetAddress: "123 Main St", unit: null },
  rateYield: 8.5,
  status: "active",
};
```

## Quality Gates
1. `bunx convex codegen` — Must succeed to update generated API types
2. `bun check` — Lint and format check
3. `bun typecheck` — TypeScript type checking
4. `bun run test` — Unit tests must pass

## File Locations
- `src/test/mic/landing-page.test.tsx`
- `src/test/mic/dashboard.test.tsx`
- `src/test/mic/portal-routes.test.tsx`
- Create `src/test/mic/` directory
