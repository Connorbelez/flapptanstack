# Chunk 4 Context: Dashboard Components — Concentration and Maturity

## Goal
Build the remaining dashboard visualization components (concentration exposure, maturity ladder) and wire the mortgage detail CTA. Ensure graceful empty states.

## Data Types (from `convex/micPortfolio/contracts.ts`)

### MicConcentrationExposureData
```tsx
interface MicConcentrationExposureData {
  byBorrower: MicConcentrationEntry[];
  byGeography: MicConcentrationEntry[];
  byPropertyType: MicConcentrationEntry[];
  byStatus: MicConcentrationEntry[];
}

interface MicConcentrationEntry {
  count: number;
  key: string;
  label: string;
  outstandingPrincipal: number;
  sharePercent: number;
}
```

### MicMaturityLadderBucket
```tsx
interface MicMaturityLadderBucket {
  bucket: "past_due" | "0_6_months" | "6_12_months" | "12_24_months" | "24_plus_months" | "unknown";
  count: number;
  outstandingPrincipal: number;
}
```

## Component Specifications

### MicConcentrationSection
- Render 4 sub-sections: By Borrower, By Geography, By Property Type, By Status
- Each sub-section is a small table or bar chart showing:
  - Label (key)
  - Count of positions
  - Outstanding Principal (formatted as currency)
  - Share Percent (formatted as percentage)
- Sort each breakdown by `sharePercent` descending
- Empty state: "No concentration data available."
- Use ShadCN `Card` for each breakdown subsection

### MicMaturityLadder
- Render as a table or horizontal bar visualization
- Columns: Time Bucket, Count, Outstanding Principal
- Bucket labels (human-readable):
  - `past_due` → "Past Due"
  - `0_6_months` → "0–6 Months"
  - `6_12_months` → "6–12 Months"
  - `12_24_months` → "12–24 Months"
  - `24_plus_months` → "24+ Months"
  - `unknown` → "Unknown"
- Empty state: "No maturity data available."

### Mortgage Detail CTA
- In the positions table and position detail drawer, conditionally render a "View full mortgage detail" link/button
- Only show when `drilldownIds.listingId` is not null
- Link to `/listings/$listingId` (the marketplace listing detail page)
- When `listingId` is null, do not render the CTA

### Empty States
All components must handle:
- `positions.length === 0` → show friendly empty message
- `metrics.outstandingPrincipal === 0` → show "No active portfolio" message
- `concentration.byBorrower.length === 0` → show empty concentration message
- `maturityLadder.length === 0` → show empty maturity message
- `payments.length === 0` → show "No payment history" message

## UI Patterns
- Use ShadCN `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Table`, `Progress`, `Badge`
- Use Tailwind for layout
- Components are pure — receive data as props
- Currency formatting: `$${value.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
- Percent formatting: `${value.toFixed(2)}%`
