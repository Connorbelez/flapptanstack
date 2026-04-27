# Chunk: chunk-01-schema-and-gt

- [x] T-010: Add `brokerOnboardingApplications` and `brokerOnboardingReviewEntries` to `convex/schema.ts` with the required lifecycle, resumability, portal, verification, reopen, and handoff fields plus lookup indexes
- [x] T-011: Extend `convex/engine/types.ts`, `convex/engine/validators.ts`, and `convex/engine/reconciliationAction.ts` for `brokerOnboardingApplication`
- [x] T-012: Add and register the `brokerOnboardingApplication` GT machine without altering shared transition-engine semantics
