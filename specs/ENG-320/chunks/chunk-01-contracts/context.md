# Chunk Context: chunk-01-contracts

## Goal
- Establish the durable activation/provenance/referral contract and record GitNexus blast radius before implementation edits.

## Relevant plan excerpts
- "Add durable provenance fields so support and retries can trace `application -> onboardingRequest -> broker -> portal` without inference."
- "Persist referral attribution from the application onto durable canonical records at activation time."
- "Keep retries idempotent: repeated approval or callback replay must reuse the same application, `onboardingRequest`, broker, and portal rows or fail closed with explicit conflict metadata."

## Implementation notes
- ENG-316 and ENG-319 contracts already exist in this worktree.
- Current `brokerOnboardingApplications` links to downstream requests but does not carry stable broker/portal activation outcome fields beyond activated portal ids.
- Current `onboardingRequests` links back to applications but has no explicit handoff key beyond `brokerOnboardingApplicationId`.
- Current `brokers` rows have user, license, org, status, and onboarding timestamps but no activation provenance/referral fields.

## Existing code touchpoints
- `convex/schema.ts`: add broker activation provenance/referral fields and any required indexes.
- `convex/onboarding/brokerApplication/internal.ts`: will consume new fields when activation completes.
- GitNexus impact findings are recorded after `npx gitnexus impact` runs in this chunk.
- GitNexus limitation: the refreshed index does not expose newer `convex/onboarding/brokerApplication/internal.ts` exports by name. Local reads show these are internal Convex callables used by broker onboarding tests and future activation wiring.
- `assignRole` exact context: `convex/engine/effects/onboarding.ts:144` has no graph-reported incoming/outgoing/processes, but it is a runtime effect seam for downstream provisioning; edits must be additive after `ASSIGN_ROLE` succeeds.

## Validation
- `/Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-320 --repo-root /Users/connor/.codex/worktrees/f0ee/fairlendapp --stage ready-to-edit`
- `bunx convex codegen` after schema edits.
