# Chunk: chunk-02-portal-scheduler

- [x] T-020: Add a thin portal-safe lender renewal read/signal/change-intent module guarded by `withPortalLender` plus `portfolio:signal_renewal`
- [x] T-021: Implement idempotent 180-day creation and 60-day expiry entrypoints backed by mortgage maturity data and current ledger positions
- [x] T-022: Register renewal creation and expiry scheduling in `convex/crons.ts` and keep reruns safe for already-created or already-transitioned intents
