# Chunk: chunk-01-backend-portal-contracts

- [x] T-001: Extract or add shared listing read helpers so explicit portal query contracts can reuse the existing pricing-aware listing logic without duplicating projection math.
- [x] T-002: Add `convex/listings/portalQueries.ts` public teaser query contract on `portalPublicQuery`.
- [x] T-003: Add authenticated lender portal listings query contract on `portalLenderQuery` and clamp requested filters against `lenderFilterConstraints`.
- [x] T-004: Add a portal-aware lender listing detail contract that enforces same-portal access and keeps detail pricing aligned with list pricing.
- [x] T-005: Add or update backend tests for public teaser reads, lender reads, pricing projection, filter clamping, and wrong-portal rejection.
