# Chunk: chunk-02-provider-safe-handoff

- [x] T-020: Add failing tests proving provider failure leaves no live mortgage.
- [x] T-021: Add a provider-safe finalization seam that calls `activateMortgageAggregate` only after provider success and commits provider-managed collection links in the same DB transaction.
- [x] T-022: Implement Rotessa customer/schedule create-or-reuse orchestration with activation-attempt references and retry-safe failure metadata.
- [x] T-023: Preserve `workflowSourceKey` idempotency and duplicate activation suppression across retries.
- [x] T-024: Implement activation-attempt failure and success transitions with package remediation/audit updates.
