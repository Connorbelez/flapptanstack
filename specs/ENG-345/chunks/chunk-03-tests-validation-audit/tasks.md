# Chunk: chunk-03-tests-validation-audit

- [x] T-030: Add checkout expiry tests for open, retryable, duplicate replay, missing provider id, provider failure, and delayed sweep cases.
- [x] T-031: Add abandon tests for owner success, non-owner rejection, admin/system allowance, and duplicate replay.
- [x] T-032: Add/extend availability assertions showing pending balances are released through `buildMarketplaceAvailabilitySummary`.
- [x] T-033: Add race/idempotency coverage for terminal status conflict, including success-vs-expiry loser behavior available in current checkout contract.
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted checkout expiry tests.
- [x] T-904: Run targeted ledger reservation tests if not fully covered by checkout tests.
- [x] T-910: Run `$linear-pr-spec-audit` for ENG-345 against the current branch diff.
- [x] T-920: Persist audit verdict to `specs/ENG-345/audit.md`.
- [x] T-930: Resolve audit findings or record blockers.
- [x] T-940: Run final artifact validation with audit and closed checklist/task requirements.
