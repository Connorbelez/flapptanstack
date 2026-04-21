# Chunk: chunk-01-engine-runtime

- [x] T-010: Extend the governed engine type surface for `lenderRenewalIntent` and add any shared renewal constants or validation helpers required by the machine
- [x] T-011: Create `convex/engine/machines/lenderRenewalIntent.machine.ts` and register it in `convex/engine/machines/registry.ts`
- [x] T-012: Update `convex/engine/reconciliation.ts` and any required lookup seams so governed lender renewal intents are reconciled without changing `executeTransition`
