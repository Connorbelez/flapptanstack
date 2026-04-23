# Spec Audit: ENG-318 - Broker onboarding: build regulator lookup abstraction and FSRA import pipeline

- Audit skill: `$linear-pr-spec-audit`
- Review target: ENG-318 implementation slice in the current worktree (the branch contains unrelated in-flight changes outside this issue)
- Last run: 2026-04-23 11:13:16 EDT
- Verdict: ready

## Findings
- None remaining.

## Unresolved items
- None.

## Next action
- Proceed with review/merge once the surrounding branch changes are acceptable.

## Coverage Summary
- SATISFIED: 10
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | data model | `fsraLicenses` and `fsraImportRuns` must exist with typed indexes and run tracking | `convex/schema.ts`, `convex/onboarding/verification/validators.ts` | Includes exact license/brokerage indexes, durable staged source rows, plus run status/trigger tracking |
| SATISFIED | integration contract | Imported-data provider must answer brokerage and individual lookups through the ENG-315 seam | `convex/onboarding/verification/interface.ts`, `convex/onboarding/verification/providers/importedFsra.ts`, `convex/onboarding/verification/registry.ts` | Brokerage and license lookups stay behind `RegulatorDirectoryProvider` |
| SATISFIED | mockability | Deterministic mock provider must cover active, not-found, suspended, stale, and brokerage-mismatch cases | `convex/onboarding/verification/fsraFixtures.ts`, `convex/onboarding/verification/providers/mockRegulator.ts`, `src/test/convex/onboarding/regulator-provider.test.ts` | Mock and imported-data providers are kept in parity |
| SATISFIED | normalization | Downstream code must get normalized statuses, freshness, brokerage linkage, and source snapshots without parsing raw records | `shared/brokerOnboarding/contracts.ts`, `convex/onboarding/verification/providers/importedFsra.ts`, `src/test/convex/onboarding/regulator-provider.test.ts` | Contracts now include brokerage and source-snapshot metadata |
| SATISFIED | freshness policy | Data older than 7 days must surface explicit stale handling instead of pretending it is current | `convex/onboarding/verification/config.ts`, `convex/onboarding/verification/fsraFixtures.ts`, `convex/onboarding/verification/fsraImport.ts`, `src/test/convex/onboarding/regulator-provider.test.ts` | 7-day freshness window is centralized in config and exercised in tests |
| SATISFIED | refresh orchestration | Manual/admin refresh and cron must share one orchestration seam and persist run state | `convex/onboarding/verification/fsraImport.ts`, `convex/onboarding/verification/actions.ts`, `convex/crons.ts`, `src/test/convex/onboarding/fsra-import.test.ts` | Manual/admin action and cron both target `runFsraImportRefresh`; row-keyed failures are persisted, replacement snapshots retire absent rows, and scheduled imports process staged rows in bounded pages |
| SATISFIED | auth | Manual refresh must stay behind `onboarding:manage` | `convex/onboarding/verification/actions.ts`, `src/test/convex/onboarding/fsra-import.test.ts` | Public refresh requires FairLend staff admin boundary plus `onboarding:manage`; members and external-org admins are rejected |
| SATISFIED | no live critical-path dependency | The issue must not introduce live FSRA calls on the onboarding critical path | `convex/onboarding/verification/providers/importedFsra.ts`, `convex/onboarding/verification/registry.ts`, `convex/onboarding/verification/fsraImport.ts` | Lookup reads local imported rows or mock data; DB-backed imported FSRA lookup surfaces bind `createImportedFsraProviderBindings(ctx)` without live provider calls |
| SATISFIED | validation | `bunx convex codegen`, `bun check`, `bun typecheck`, and focused onboarding tests must pass | local validation run on 2026-04-23 | `bun check` still reports pre-existing repo complexity warnings outside ENG-318 scope, but exited successfully; focused Vitest files passed with 18 tests and `git diff --check` passed |
| SATISFIED | operations | Daily automated import attempt must be functionally wired to a real FSRA row supplier | `convex/schema.ts`, `convex/crons.ts`, `convex/onboarding/verification/fsraImport.ts`, `src/test/convex/onboarding/fsra-import.test.ts` | Manual/admin refreshes stage normalized source rows in `fsraSourceRows`; cron-triggered refreshes load those staged rows in pages when inline records are omitted |
