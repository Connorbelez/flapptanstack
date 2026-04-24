# Chunk Context: chunk-03-action-orchestration

## Goal
- Implement the public checkout-start orchestration action.

## Relevant plan excerpts
- Do not call Stripe from a Convex mutation. Use action/server orchestration plus internal mutations.
- Attach provider identifiers and transition to `hosted_checkout_open` before returning the URL.
- If provider identifiers cannot be attached after provider creation, compensate locally and attempt to expire the provider session when possible.

## Implementation notes
- Use `authedAction` plus `requirePermissionAction("listing:invest")` or an equivalent fluent action chain.
- The internal prepare mutation remains responsible for DB-backed listing/portal/lender validation.
- Public action should map validation and provider failures into the typed result contract.

## Existing code touchpoints
- `convex/fluent.ts`: action auth/permission middleware exists.
- `convex/_generated/api.*`: update via `bunx convex codegen` after adding Convex exports.

## Validation
- Targeted action tests with fake provider and compensation assertions.
