# Chunk: chunk-03-provisioning-effect

- [x] T-310: Add `convex/micInvestorAccessRequests/internal.ts` with request lookup, provisioning begin/complete/fail helpers, and journal id idempotency.
- [x] T-320: Add `convex/engine/effects/micInvestorAccessRequests.ts` provisioning action using `getWorkosProvisioning()`.
- [x] T-330: Extend WorkOS provisioning types only as needed to capture user and membership ids while preserving existing callers.
- [x] T-340: Register the provisioning effect in `convex/engine/effects/registry.ts`.
- [x] T-350: Add Convex tests for existing user reuse, create-user path, MIC membership role/org, already-member success, provider failure visibility, and retry/idempotency behavior.
