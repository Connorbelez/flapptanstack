# Chunk: chunk-02-activation-helpers

- [x] T-020: Add canonical broker resolve-or-provision helper with strongest-identifier-first lookup, `_id` stability, and fail-closed conflict handling.
- [x] T-021: Add reusable broker portal upsert helper using shared slug normalization, reserved slug rejection, host derivation, pricing, and portal registry invariants.
- [x] T-022: Add broker activation coordinator that resolves/provisions broker, upserts portal, syncs `users.homePortalId`, persists provenance/referral data, and returns a stable activation outcome.
