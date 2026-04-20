# Chunk: chunk-03-builders-and-proof

- [x] T-040: Extend `convex/fluent.ts` with portal-aware builders for public, authenticated, lender, and borrower portal functions
- [x] T-045: Convert portal-aware builders into structural fluent-convex extensions that inject portal context into handler `ctx`
- [x] T-046: Tighten `resolvePortalLender` so lender access is broker-only for the current portal
- [x] T-047: Tighten `resolvePortalBorrower` to the transitional deterministic by-org portal mapping and note the `ENG-302` handoff in code
- [x] T-050: Add the minimal portal query surface needed by the middleware and a thin proof consumer that exercises the new builders without broad product rewrites
- [x] T-051: Rewrite `convex/portals/proof.ts` so proof consumers use builder-injected portal context
- [x] T-060: Update `convex/auth/resourceChecks.ts` and related wrappers to reuse shared actor-resolution helpers while keeping portal membership outside resource checks
