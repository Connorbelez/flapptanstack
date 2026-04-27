# Chunk 01: Seed And Backend

## Goal

Create a deterministic MIC scenario that proves the ledger-derived portfolio contracts and MIC investor request lifecycle without relying on WorkOS network calls.

## Tasks

- [ ] Build `src/test/convex/mic/seedMicScenario.ts`.
- [ ] Seed one MIC portal using `micPortalFields` with explicit `micLenderAuthId`.
- [ ] Seed admin and MIC investor identities using existing auth test helpers.
- [ ] Seed at least two active/funded mortgages with properties, borrower links, listings, obligations, ledger minting, and MIC position share issuance.
- [ ] Seed at least one non-MIC lender position on a different lender auth id and assert portfolio queries exclude it.
- [ ] Return stable expected values for dashboard totals, position labels, maturity buckets, and unsupported metric warnings.
- [ ] Add `micPortfolio` Convex tests for dashboard, positions, detail, payments, concentration, and non-MIC exclusion.
- [ ] Extend provisioning lifecycle tests to use the scenario where appropriate and assert completed provisioning + home portal assignment.

## Verification

- `bun test src/test/convex/micPortfolio`
- `bun test src/test/convex/micInvestorAccessRequests`
- `bunx convex codegen`
