# Status: chunk-04-effects-compatibility

- Result: complete
- Last updated: 2026-04-24T20:40:11Z

## Completed tasks
- T-040
- T-041
- T-042

## Validation
- `bun run test convex/engine/effects/__tests__/dealLockingFee.test.ts`: pass

## Notes
- This chunk is a release guard for the main money-flow risk: payment and reservation now happen before `DEAL_LOCKED`, while the existing effects were written for after-lock side effects.
- `reserveShares` now no-ops when a checkout-created reservation is already linked. `collectLockingFee` now no-ops when Stripe checkout already collected the CAD 250 fee.
