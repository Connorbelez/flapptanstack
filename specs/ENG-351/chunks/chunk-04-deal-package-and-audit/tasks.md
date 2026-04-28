# Chunk 04: deal package and audit

- [ ] T-040: Add full paid-checkout handoff coverage proving exactly one deal, package, access set, checkout/deal linkage, reservation linkage, lock-fee transfer linkage, and Stripe reference set.
- [ ] T-041: Add package handoff coverage proving active private blueprints are snapshotted and `lender_primary` / `lawyer_primary` resolve from checkout participants for platform and guest lawyer paths.
- [ ] T-042: Add idempotent retry coverage for duplicate webhook plus return-polling handoff and deal insert succeeds / package generation fails / retry repairs package scenarios.
- [ ] T-043: Add access boundary coverage proving selected lawyer has scoped access to only the created deal and unrelated users/deals are denied.
- [ ] T-044: Assert audit evidence for deal creation, duplicate replay, package failure, access failure, and rejected handoff transitions.
- [ ] T-045: Fix any deal handoff, package generation, access, reservation effect, or audit defects revealed by T-040 through T-044.
