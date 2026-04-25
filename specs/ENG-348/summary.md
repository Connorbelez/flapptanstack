# Summary: ENG-348 - Deal closing: ship buyer and seller workspaces

- Source issue: https://linear.app/fairlend/issue/ENG-348/deal-closing-ship-buyer-and-seller-workspaces
- Primary plan: https://www.notion.so/34cfc1b4402481df90c6e17521f9b3ef
- Supporting docs:
  - https://www.notion.so/321fc1b440248127a3bef2ea0371aaf6
  - https://www.notion.so/317fc1b4402481a0964ded0ec547a9de
  - https://www.notion.so/313fc1b440248189a811ee4c5e551798

## Scope
- Add participant-safe Convex queue/detail projections for buyer and seller My Closings and workspaces.
- Add shared task-first participant UI for queue, workspace shell, overview, documents/signatures, timeline, parties/counsel, blocker states, signing task, and completion receipt.
- Add buyer/seller route entry points with authenticated suspense wrappers.
- Preserve existing package visibility and signable placeholder behavior.
- Add focused Convex, component, route, and e2e coverage for authorization, token visibility, edge states, and completion receipts.

## Constraints
- WorkOS AuthKit is the identity source of truth; React auth state must use the canonical WorkOS client hook when needed.
- Buyer/seller authority must come from server-side deal access and ENG-338 participant/access/fraction projections, not raw buyerId/sellerId client filtering.
- Embedded signing tokens may only be returned for the authenticated current recipient with a non-expired server token.
- Signable package members stay non-downloadable until server artifact availability is explicit.
- Completion receipts must use ENG-343 participant-safe evidence, not deal status alone.
- UI must not patch deal statuses or emit unauthorized governed events.
- Exported Convex functions must use fluent builders with explicit `.public()` or `.internal()`.

## Open questions
- none
