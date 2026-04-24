# Chunk: chunk-04-effects-compatibility

- [x] T-040: Update `reserveShares` effect to confirm or no-op when a checkout-created reservation is already linked to the deal.
- [x] T-041: Update `collectLockingFee` to skip or reconcile when Stripe checkout already collected the CAD 250 lock fee.
- [x] T-042: Add or update deal/effect tests proving no duplicate reservation, fee transfer, package, access grant, or deal is created by retries.
