# Chunk Manifest: ENG-300 - Broker portal: define the v1 portal pricing policy contract

| Chunk | Tasks | Status | Notes |
| ----- | ----- | ------ | ----- |
| chunk-01-contract-schema | T-010, T-011 | complete | schema and validators now encode the explicit v1 broker-cut contract plus deterministic lifecycle fields |
| chunk-02-pricing-selection | T-020, T-021, T-022 | complete | reusable selection, fail-closed behavior, and shared projection math landed without broad query rollout |
| chunk-03-integration-validation | T-030, T-031, T-900, T-910, T-920 | blocked | tests and audit are recorded, but codegen, `bun check`, and CodeRabbit are blocked by environment and repo-wide conditions |
