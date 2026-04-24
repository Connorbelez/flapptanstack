# Summary: ENG-343 - Deal closing: harden funds confirmation and close-side effects

- Source issue: https://linear.app/fairlend/issue/ENG-343/deal-closing-harden-funds-confirmation-and-close-side-effects
- Primary plan: https://www.notion.so/34cfc1b440248172a5e4d3a4d10038d5
- Supporting docs:
  - https://www.notion.so/313fc1b440248189a811ee4c5e551798
  - https://www.notion.so/321fc1b440248127a3bef2ea0371aaf6
  - https://www.notion.so/325fc1b4402481fa935dc8056ad385c9
  - https://www.notion.so/325fc1b4402481b28634dde30257d459
  - https://www.notion.so/34cfc1b440248146ad2cde40d49a8828
  - https://www.notion.so/34cfc1b44024819fa197fa2164623f46

## Scope
- Replace logged close-side stubs with durable, queryable funds evidence and signed archive behavior.
- Define a shared `FundsReceiptSource` contract for provider-backed and manual admin evidence.
- Add schema, validators, and helpers for funds evidence, signed archive records, close effect outcomes, and blocking exceptions.
- Ensure provider-backed `FUNDS_RECEIVED` is tied to completed transfer pipeline leg 2 seller payout evidence for the same deal.
- Add a FairLend staff admin manual funds confirmation path with actor, timestamp, evidence note, and optional `documentAssets` attachments.
- Preserve governed transition semantics and existing idempotent reservation, proration, reroute, and lawyer access cleanup behavior.
- Expose admin/internal close evidence and participant-safe close receipt summaries for downstream ENG-346 and ENG-348.
- Add targeted Convex tests for evidence validation, duplicate/out-of-order provider events, cancelled/failed protection, archive blockers, retry behavior, and projection visibility.

## Constraints
- All deal status changes must go through `executeTransition`; never patch `deals.status` directly.
- `FUNDS_RECEIVED` is only valid from `fundsTransfer.pending`; cancelled and failed deals must not advance from late provider or manual events.
- Staff-global manual confirmation must use FairLend staff admin semantics, not `admin:access` alone.
- Provider-backed confirmation must verify a completed leg 2 seller payout for the same deal/pipeline.
- Missing signed artifacts must create visible archive exceptions or blockers rather than silent success.
- Close side effects must be idempotent on retries and duplicate provider events.
- Participant-safe projections must not expose admin-only operational notes or manual evidence details.
- Financial math must preserve ENG-338 10,000-based fraction units.
- Exported Convex functions must use fluent-convex builders with explicit `.public()` or `.internal()` visibility.

## Open questions
- None blocking. If ENG-342 signed artifact storage is absent or incomplete in this worktree, archive handling will target the planned active completed envelope/artifact contract and record a safe missing-artifact exception.
