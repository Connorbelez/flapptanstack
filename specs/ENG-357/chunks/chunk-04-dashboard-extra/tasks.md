# Chunk 4: Dashboard Components — Concentration and Maturity

## Tasks

- [ ] T-030: Add `src/components/mic/MicConcentrationSection.tsx` rendering `MicConcentrationExposureData` breakdowns (borrower, geography, property type, status).
- [ ] T-031: Add `src/components/mic/MicMaturityLadder.tsx` rendering `MicMaturityLadderBucket[]` with counts and outstanding principal per bucket.
- [ ] T-032: Wire "View full mortgage detail" CTA from position rows using `drilldownIds.listingId` when present; hide CTA when `listingId` is null.
- [ ] T-033: Ensure all dashboard components handle empty-state gracefully (no positions, no payments, etc.).
