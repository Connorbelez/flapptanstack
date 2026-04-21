# Chunk Context: chunk-02-portal-scheduler

## Goal
- Publish the lender-facing renewal read/signal/change-intent surface and the internal create/expire scheduling hooks that downstream portfolio UI issues will consume.

## Relevant plan excerpts
- `Add lender-facing read and signal/change-intent endpoints guarded by portal/lender context plus portfolio:signal_renewal.`
- `Implement idempotent create-window and expire-window entrypoints for 180-day creation and 60-day expiry handling.`
- `portalLenderMutation(...) and portalLenderQuery(...) are the right builder seams for the public command/read surface.`
- `The repo already has a permission slot for lender renewal signaling, which supports a thin lender-facing command surface.`

## Implementation notes
- There is no existing `convex/portfolio/` runtime module in the repo, so this slice should use a thin renewal-focused module rather than reopening unrelated listing or portal files.
- `portalLenderQuery(...)` and `portalLenderMutation(...)` already enforce portal context plus `lender:access`; layer `requirePermission("portfolio:signal_renewal")` onto the mutation surface and any sensitive renewal reads that need it.
- Portal middleware resolves the canonical lender from auth plus portal context. The renewal surface must not accept lender identity from the client.
- Current holding validation should be derived from the ledger POSITION seams (`ledger_accounts`, `getLenderPositions`, and per-mortgage position lookups), not from renewal payloads.
- Mortgage `maturityDate` is stored as a strict `YYYY-MM-DD` string, while renewal intents store `maturityDate` and `signalDeadline` as Unix ms. Use shared business-date helpers or a deterministic equivalent for conversions.
- Review whether the existing `CommandSource` enums are sufficient for lender renewal transitions before widening shared source types. Avoid shared enum churn unless the code path requires it.

## Existing code touchpoints
- `convex/fluent.ts` and `convex/portals/middleware.ts` as the reference auth pattern
- `convex/ledger/queries.ts`
- `convex/crons.ts`
- New renewal runtime modules under `convex/renewals/` or another thin renewal-specific folder
- `convex/engine/commands.ts` only if a typed renewal transition wrapper is materially cleaner than calling `executeTransition` directly inside a portal mutation
- GitNexus note: if this chunk ends up touching shared source-type symbols such as `buildSource`, `ActorType`, or `CommandChannel`, run another impact pass before editing them

## Validation
- `bun run test -- src/test/convex/engine/crossEntity.test.ts`
- targeted renewal portal and scheduler tests once those files exist
- `bunx convex codegen`
