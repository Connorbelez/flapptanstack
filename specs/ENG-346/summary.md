# Summary: ENG-346 - Deal closing: upgrade admin operations console

- Source issue: https://linear.app/fairlend/issue/ENG-346/deal-closing-upgrade-admin-operations-console
- Primary plan: https://www.notion.so/34cfc1b440248141a0d7e1468697150e
- Supporting docs:
  - https://www.notion.so/313fc1b440248189a811ee4c5e551798
  - https://www.notion.so/321fc1b440248127a3bef2ea0371aaf6
  - https://www.notion.so/322fc1b44024811cbccad22752327a08
  - https://www.notion.so/34cfc1b440248146ad2cde40d49a8828
  - https://www.notion.so/34cfc1b44024819fa197fa2164623f46
  - https://www.notion.so/34cfc1b440248172a5e4d3a4d10038d5

## Scope
- Replace the default `/admin/deals` route with a phase-grouped operations pipeline using current server projections, not the generic CRM table.
- Replace `/admin/deals/$recordid` with a dedicated operations console that preserves admin shell routing while showing lifecycle, signing, package, access, funds, close effect, blocker, and audit context.
- Add or extend Convex admin deal operations projections using current ENG-338 participant projection, ENG-342 envelope/signing tables, and ENG-343 close evidence tables now present in this worktree.
- Add pure frontend view-model helpers, focused component tests, query/projection tests, and update e2e coverage for the admin operations workflow.
- Keep governed action execution routed through `transitionDeal` or subordinate document/funds operations; do not patch `deals.status` directly.

## Constraints
- The upstream codebase has evolved: `participantProjection.ts`, `envelopes.ts`, `envelopeWebhooks.ts`, `closeEvidence.ts`, `getAdminCloseEvidence`, and participant workspace projections already exist and must be consumed rather than duplicated.
- FairLend staff admin auth remains mandatory through existing `/admin` route guards and `adminQuery` / `adminMutation` backend projections.
- `admin:access` alone is not staff-global authority; external-org admins must not satisfy staff admin gates.
- Lifecycle display and valid action affordances must derive from server state and the deal machine contract; no UI-local lifecycle state machine.
- Payload-required actions must collect payload before mutation. Manual funds confirmation already has `confirmManualFundsReceipt`; cancellation must require a non-empty reason.
- Exported Convex functions must use fluent builders with explicit `.public()` or `.internal()`.
- Existing dirty files before this work: `convex/documentEngine/variableRegistry.ts` and `convex/documents/contracts.ts`. Avoid touching them unless unavoidable.
- GitNexus worktree index is current as of 2026-04-28T18:43:58Z. Impact checks for planned existing symbols returned LOW risk.

## Open questions
- None block implementation. If a specific optional upstream projection row is absent at runtime, render an explicit missing-contract or unavailable state instead of inventing fallback semantics.
