# Execution Status: ENG-319 - Broker onboarding: implement verification pipeline and abuse controls

- Overall status: complete
- Current phase: complete
- Current chunk: none
- Last updated: 2026-04-23 20:36:24 EDT

## Active focus
- Implementation, validation, and spec audit are complete for ENG-319.

## Blockers
- none

## Notes
- Linear issue requirements and definition of done are present and concrete. The primary implementation plan plus the threshold spec, state-machine notes, and ENG-315/316/318 supporting plans have been read.
- Dependency slices already exist in this worktree: provider contracts and WorkOS email gate from ENG-315, aggregate/handoff seams from ENG-316, and imported/mock regulator providers from ENG-318.
- Current gaps vs ENG-319 are the runtime layer, Jaro-Winkler scoring utility, callback verification/persistence/processing, rate limiting, IDV start/recompute surfaces, and explicit reverification invalidation state.
- The verification contract layer is already partially in place in `shared/brokerOnboarding/contracts.ts`, but `convex/onboarding/brokerApplication/validators.ts` does not yet validate all regulator snapshot fields needed by ENG-319.
- GitNexus pre-edit impact:
  - `convex/onboarding/brokerApplication/internal.ts:upsertVerificationSnapshot`: LOW, no detected upstream callers or affected processes.
  - `convex/onboarding/brokerApplication/internal.ts:requestChanges`: LOW, no detected upstream callers or affected processes.
  - `convex/onboarding/brokerApplication/mutations.ts:submit`: LOW, no detected upstream callers or affected processes.
  - `convex/onboarding/brokerApplication/validators.ts:brokerOnboardingVerificationSnapshotValidator`: LOW, no detected upstream callers or affected processes.
- The `linear-implement-v2` scaffold/validator scripts are being run from the skill bundle at `/Users/connor/.codex/skills/linear-implement-v2/scripts/` against this repo root.
- `ready-to-edit` validation passed on 2026-04-23 11:48:37 EDT, so chunk execution can proceed.
- Runtime-foundation implementation is green:
  - `bunx convex codegen`
  - `bunx vitest run src/test/convex/onboarding/name-matching.test.ts src/test/convex/onboarding/verification-runtime.test.ts src/test/convex/onboarding/verification-contracts.test.ts`
- Additional GitNexus pre-edit impact for the aggregate/callback slice:
  - `convex/onboarding/verification/fsraImport.ts:normalizeFsraSourceRecord`: LOW, one direct same-file caller and no affected processes.
  - `convex/onboarding/verification/fsraFixtures.ts:FsraSourceRecord`: LOW, four direct importers plus one transitive module and no affected processes.
  - `convex/onboarding/verification/providers/importedFsra.ts:ImportedFsraRegulatorRecord`: LOW, two direct importers and no affected processes.
  - `convex/onboarding/verification/providers/importedFsra.ts:ImportedFsraBrokerageRecord`: LOW, two direct importers and no affected processes.
- Aggregate, callback, abuse-control, and test implementation are complete for ENG-319.
- Scoped validation passed on 2026-04-23 20:36 EDT:
  - `bunx convex codegen`
  - `bun check` (exits 0; existing repo-wide cognitive-complexity warnings remain outside ENG-319)
  - `bun typecheck`
  - `bunx vitest run src/test/convex/onboarding/brokerApplication.aggregate.test.ts src/test/convex/onboarding/brokerApplication.handoff.test.ts src/test/convex/onboarding/idv-callback.test.ts src/test/convex/onboarding/name-matching.test.ts src/test/convex/onboarding/verification-contracts.test.ts src/test/convex/onboarding/verification-rate-limit.test.ts src/test/convex/onboarding/verification-runtime.test.ts` (7 files, 34 tests passed; Vitest prints a post-run close-timeout notice after successful test completion)
- Full `bun run test -- --reporter=dot --silent` was attempted on 2026-04-23 20:25 EDT and remains blocked by 21 unrelated failures in non-onboarding areas: listing fixture schema drift around `marketplacePropertyType`, one backend auth architecture guard, one collection transfer auth expectation, and lender listing page tests missing `ConvexProvider`. The prior onboarding scheduled-work unhandled error from `brokerApplication.handoff.test.ts` was fixed and no longer appears.
- `$linear-pr-spec-audit` verdict: ready. Two audit findings were identified and fixed before closeout:
  - stale regulator data now maps to `review_needed` with `stale_regulator_data` reason code instead of a separate non-review recommendation.
  - invalid callback signatures no longer persist trusted application/session linkage, valid provider retries can recover failed invalid-signature callback events, and loose callback application IDs are normalized before lookup.
