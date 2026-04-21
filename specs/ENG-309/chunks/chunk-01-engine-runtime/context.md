# Chunk Context: chunk-01-engine-runtime

## Goal
- Make `lenderRenewalIntent` a real governed entity by landing the machine, governed type registration, and reconciliation coverage without changing unrelated transition semantics.

## Relevant plan excerpts
- `Add lenderRenewalIntent to the governed-machine runtime by extending GovernedEntityType and registering a dedicated machine.`
- `Keep the implementation additive; do not refactor executeTransition semantics for unrelated machines.`
- `Update reconciliation coverage so governed renewal intents are not silently skipped once the machine is live.`

## Implementation notes
- `lenderRenewalIntent` already exists in schema, `EntityType`, `ENTITY_TABLE_MAP`, `entityTypeValidator`, and `reconciliationAction.ts`; the missing runtime seam is governed registration.
- `convex/engine/transition.ts` already resolves machines generically from `machineRegistry`. Because its GitNexus blast radius is `CRITICAL`, prefer solving ENG-309 by extending the governed surface rather than editing the transition core.
- Keep renewal-specific state and event rules inside the machine and any narrow helper layer, not scattered across future portal endpoints.
- `reconciliation.ts` currently skips `lenderRenewalIntent` explicitly, so this chunk must close that mismatch as part of the governed rollout.

## Existing code touchpoints
- `convex/engine/types.ts`
- `convex/engine/machines/registry.ts`
- `convex/engine/machines/lenderRenewalIntent.machine.ts`
- `convex/engine/reconciliation.ts`
- `convex/engine/reconciliationAction.ts` as the reference seam that already reads `lenderRenewalIntents.status`
- GitNexus findings:
  - `executeTransition`: `CRITICAL`, 46 upstream impacts, shared modules include Transfers, Seed, Webhooks, Engine, CashLedger, and RecurringSchedules
  - `machineRegistry`: `LOW`
  - `reconcile`: `LOW`

## Validation
- `bun run test -- convex/engine/machines/__tests__/lenderRenewalIntent.machine.test.ts convex/engine/machines/__tests__/registry.test.ts src/test/convex/engine/transition.test.ts`
- `bunx convex codegen`
