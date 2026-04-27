# Chunk 3 Context: Dashboard Components — Metrics and Positions

## Goal
Build the core dashboard components that render MIC portfolio data: metrics cards, positions table, position detail drawer, and data warnings banner.

## Data Types (from `convex/micPortfolio/contracts.ts`)

### MicPortfolioMetrics
```tsx
interface MicPortfolioMetrics {
  activePositionCount: number;
  arrearsExposure: number;
  delinquencyExposure: number;
  outstandingPrincipal: number;
  weightedAverageLtv: number | null;
  weightedAverageYield: number | null;
}
```

### MicPositionRow
```tsx
interface MicPositionRow {
  arrearsSignal: {
    overdueAmount: number;
    overdueCount: number;
    status: "current" | "due" | "overdue" | "exception";
  };
  borrowerLabel: string;
  drilldownIds: {
    listingId: string | null;
    mortgageId: string;
    positionAccountId: string;
    propertyId: string;
  };
  ltv: number | null;
  maturityDate: string;
  mortgageId: string;
  outstandingPrincipal: number;
  positionAccountId: string;
  positionUnits: number;
  principal: number;
  propertyLabel: string;
  propertySummary: {
    city: string;
    propertyType: string;
    province: string;
    streetAddress: string;
    unit: string | null;
  };
  rateYield: number | null;
  status: string;
}
```

### MicPositionDetailData
```tsx
interface MicPositionDetailData {
  mortgage: {
    amortizationMonths: number;
    firstPaymentDate: string;
    interestRate: number;
    lienPosition: number;
    loanType: string;
    maturityDate: string;
    mortgageId: string;
    paymentAmount: number;
    paymentFrequency: string;
    principal: number;
    rateType: string;
    status: string;
    termMonths: number;
    termStartDate: string;
  };
  payments: MicPaymentHistoryRow[];
  position: MicPositionRow;
  property: {
    city: string;
    postalCode: string;
    propertyId: string;
    propertyType: string;
    province: string;
    streetAddress: string;
    unit: string | null;
  };
}
```

### MicPaymentHistoryRow
```tsx
interface MicPaymentHistoryRow {
  amountSettled: number;
  dueDate: string;
  grossAmount: number;
  latestCollectionStatus: string | null;
  latestTransferStatus: string | null;
  micShareAmount: number;
  mortgageId: string;
  obligationId: string;
  paymentNumber: number;
  propertyLabel: string;
  rowStatus: string;
  type: string;
}
```

### Portfolio Envelope
All responses include:
```tsx
{
  generatedAt: number;
  sourceOfTruth: "mortgage_ledger_lender_participation";
  dataCompleteness: "complete" | "partial";
  warnings: string[];
}
```

## Component Specifications

### MicDashboardMetrics
- Render as a grid of metric cards
- Format currency values with `$` prefix and 2 decimal places
- Format percentages with `%` suffix and 2 decimal places
- Show `weightedAverageLtv` and `weightedAverageYield` as "N/A" when null
- Display:
  - Outstanding Principal
  - Active Position Count
  - Weighted Average Yield
  - Weighted Average LTV
  - Arrears Exposure
  - Delinquency Exposure

### MicPositionsTable
- Use `@tanstack/react-table` if available, otherwise simple HTML table with ShadCN `Table` components
- Columns: Property, Borrower, Status, Principal, Yield, LTV, Maturity, Arrears
- Search input filtering by `searchQuery` (pass to `getMicPositions` filters)
- Optional filters: status, property type, province
- Row click opens the detail drawer
- Sortable columns
- Empty state: "No active MIC positions found."

### MicPositionDetailDrawer
- Use ShadCN `Sheet` component for drawer
- Triggered by row click in positions table
- Content sections:
  - **Property**: address, city, province, postal code, property type
  - **Mortgage Terms**: principal, interest rate, rate type, term, amortization, payment amount, frequency, lien position, maturity date, status
  - **Position**: outstanding principal, position units, LTV, arrears signal
  - **Payment History**: table of payments with due date, gross amount, MIC share, status, collection/transfer status
- Use `getMicPositionDetail` for main data
- Use `getMicPaymentsHistory` scoped to the mortgageId for payment history

### MicDataWarnings
- Render as a banner/alert at the top of the dashboard
- When `dataCompleteness === "partial"`, show amber warning style
- List all `warnings` strings
- Never invent warnings — only surface what the backend returns

## UI Patterns
- Use ShadCN components: `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Badge`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `Sheet`, `Alert`, `AlertDescription`, `Input`, `Select`, `Button`
- Use Tailwind for layout and spacing
- Keep components pure — receive data as props, no direct query calls
- The parent route component handles all `useSuspenseQuery` calls and passes data down
