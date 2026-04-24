# Chunk: chunk-01-claim-contract

- [x] T-010: Add `convex/brokers/claimConvergence.ts` with typed claim inputs, deterministic outcomes, safe-match detection, fallback routing, and reuse of broker activation helpers.
- [x] T-011: Narrowly adjust `convex/brokers/resolveOrProvision.ts` so broker onboarding application provenance can be optional for future claim consumers while preserving ENG-320 behavior.
- [x] T-012: Ensure safe claim matches patch the canonical broker and reuse broker portal/home-portal assignment without creating duplicate broker rows.
