# Chunk: chunk-01-backend-review-api

- [x] T-010: Add backend queue filter validators and review action validators in `convex/onboarding/brokerApplication/validators.ts`.
- [x] T-020: Add admin review queue and dossier projections in `convex/onboarding/brokerApplication/queries.ts`.
- [x] T-030: Add public admin review mutations in `convex/onboarding/brokerApplication/mutations.ts` that call internal command surfaces and require reviewer notes.
- [x] T-040: Tighten internal review command validation in `convex/onboarding/brokerApplication/internal.ts` for approve notes, request-changes note emptiness, reopened fields, and reverification flags.
- [x] T-050: Reconcile onboarding review permission docs if runtime usage requires clarification.
  - No doc change required: runtime wiring uses the existing `onboarding:review` permission plus the established FairLend admin route guard.
