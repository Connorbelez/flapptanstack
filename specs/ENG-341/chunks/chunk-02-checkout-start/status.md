# Status: chunk-02-checkout-start

- Result: complete
- Last updated: 2026-04-24T20:03:05Z

## Completed tasks
- T-020
- T-021
- T-022
- T-023

## Validation
- `bunx convex codegen`: pass
- `bun test convex/dealLocks/__tests__/checkout.test.ts`: pass

## Notes
- Do not contact Stripe until all server-side validation has passed.
- Stripe provider config is checked in the action before reservation creation; internal mutation tests cover the server-side validation/reservation lifecycle.
