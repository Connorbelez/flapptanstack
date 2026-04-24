# Chunk: chunk-03-workflow-regression

- [x] T-030: Add unit tests for scenario generation, deterministic bounded values, named scenarios, and patch helpers.
- [x] T-031: Add integration tests for webhook idempotency and 1:1 `linkApplicationId` identity using mock scenarios.
- [x] T-032: Add integration tests for readiness gates, final-review invalidation, unsupported payment frequency, missing PAD, and incomplete bank data.
- [x] T-033: Add activation tests proving Rotessa customer/schedule failure creates no live mortgage, retry reuses artifacts, success activates canonically, and post-live drift does not mutate canonical records.
- [x] T-034: Add package query contract coverage where the mock harness exposes workflow payload assumptions for ENG-335.
