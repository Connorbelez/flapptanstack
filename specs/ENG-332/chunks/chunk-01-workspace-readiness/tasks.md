# Chunk: chunk-01-workspace-readiness

- [x] T-010: Add Velocity workspace DTO assembly for board rows and detail payloads.
- [x] T-011: Add `listVelocityPackageWorkspaces` query with state/exception filters.
- [x] T-012: Add `getVelocityPackageWorkspace` query with immutable Velocity core, mutable enrichment/remediation, readiness, documents, exceptions, and snapshots.
- [x] T-013: Add enrichment/remediation patch mutation that preserves Velocity-owned core facts, recomputes readiness/state, and appends package audit entries.
- [x] T-014: Reuse/export shared readiness state derivation so sync and workspace mutations resolve states consistently.
