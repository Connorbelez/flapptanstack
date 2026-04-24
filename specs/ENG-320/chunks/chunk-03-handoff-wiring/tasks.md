# Chunk: chunk-03-handoff-wiring

- [x] T-030: Add an internal create-or-link helper for approved applications to produce one downstream broker `onboardingRequest` with provenance.
- [x] T-031: Wire approval paths to create/link and approve the downstream request through the existing `onboardingRequest` GT path.
- [x] T-032: Wire the downstream role-assignment effect to call the broker activation seam after `ASSIGN_ROLE` completes.
- [x] T-033: Keep existing manual link/role-assigned/mark-activated helpers idempotent and compatible with the new activation outcome.
