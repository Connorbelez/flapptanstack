# Chunk Context: chunk-01-runtime-foundation

## Goal
- Add the verification data model and runtime foundation so broker onboarding can create normalized snapshots from WorkOS email state, regulator results, and IDV evidence without yet wiring public entry points or callback HTTP ingestion.

## Relevant plan excerpts
- "Extend `brokerOnboardingApplication` persistence with normalized verification snapshot fields, recommendation state, reason codes, evidence references, timestamps, and reverification-invalidated markers required by downstream review and handoff flows."
- "Implement name normalization plus Jaro-Winkler pair scoring, using the minimum pairwise score as the effective score exactly as the spec requires."
- "Persist normalized regulator evidence, IDV evidence, verified-email evidence, scores, fraud outcomes, freshness state, and reason codes on the aggregate so the UI never recomputes policy."

## Implementation notes
- `shared/brokerOnboarding/contracts.ts` already owns normalized verification shapes, recommendation vocabulary, province normalization, and final recommendation evaluation. ENG-319 should consume that layer instead of redefining enums or thresholds.
- No Jaro-Winkler helper exists in the repo today. The new utility should stay narrow, deterministic, and backend-focused instead of adding a large dependency.
- `convex/onboarding/brokerApplication/validators.ts` currently validates a reduced regulator snapshot shape and will need to grow to match the richer shared contract fields the runtime should persist.
- `convex/schema.ts` already has aggregate-level verification fields from ENG-316, but it does not yet have broker-onboarding callback-event persistence or explicit reverification-invalidated markers.

## Existing code touchpoints
- `shared/brokerOnboarding/contracts.ts`
- `convex/onboarding/brokerApplication/validators.ts`
- `convex/schema.ts`
- `convex/onboarding/verification/interface.ts`
- `convex/onboarding/verification/registry.ts`
- `convex/onboarding/verification/providers/importedFsra.ts`
- GitNexus: `brokerOnboardingVerificationSnapshotValidator` is LOW risk with no detected upstream callers/processes.

## Validation
- `bunx convex codegen`
- `bun run test -- src/test/convex/onboarding/name-matching.test.ts src/test/convex/onboarding/verification-runtime.test.ts`
