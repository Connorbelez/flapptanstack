# Chunk: chunk-03-workspace-upsert

- [x] T-030: Implement idempotent workspace lookup/create/update by `linkApplicationId` and collision detection.
- [x] T-031: Implement snapshot creation only when upstream normalized core hash changes and duplicate-noop behavior for repeated full-deal hashes.
- [x] T-032: Implement package exception open/supersede behavior for identity, sync, mapping, and required-core-field failures with webhook/sync provenance.
- [x] T-033: Write ingress and sync lifecycle audit entries via `appendVelocityPackageAuditEntry`.
- [x] T-034: Expose manual `Sync now` through a fluent Convex action/mutation surface that reuses the shared sync path.
