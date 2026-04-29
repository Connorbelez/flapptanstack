# Chunk: chunk-02-import-provider

- [x] T-030: Create `convex/onboarding/verification/fsraImport.ts` with normalization helpers, freshness ownership, stable-identifier upserts, and run helpers.
- [x] T-040: Implement the imported-data FSRA provider against local storage for exact individual-license and brokerage lookups.
- [x] T-050: Upgrade the deterministic mock provider and fixtures to match imported-data semantics, including stale and brokerage-mismatch coverage.
- [x] T-060: Wire the verification registry/config so the imported-data provider resolves through the existing strategy seam.
