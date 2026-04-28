# Chunk 02: start expiry and races

- [ ] T-020: Add a deterministic final-fractions race test proving one buyer succeeds, one fails with `insufficient_fractions`, and no dangling reservation/session remains.
- [ ] T-021: Expand provider-start failure coverage to assert checkout `provider_start_failed`, reservation voiding, availability restoration, and audit evidence.
- [ ] T-022: Expand expiry/abandon tests to cover provider expiry success/failure, duplicate sweeps, success-vs-expiry race behavior, and ledger-derived availability restoration.
- [ ] T-023: Add checkout start auth/tampering tests for unauthenticated, non-lender, wrong portal, hidden-by-filter listing, demo listing, tampered availability, tampered fee, tampered lawyer label, and tampered Stripe metadata.
- [ ] T-024: Fix any checkout start, expiry, ledger reservation, portal visibility, or audit defects revealed by T-020 through T-023.
