# Chunk Context: chunk-02-aggregate-entrypoints

## Goal
- Wire the aggregate-owned verification hooks and public verification entry points so the broker application can start IDV, recompute verification state, and map outcomes to approved, reviewer-held submitted, or rejected without callback handlers mutating status directly.

## Relevant plan excerpts
- "Map verification runtime output into canonical outcome intents that the aggregate command surface translates into `approved`, reviewer-held `submitted`, or `rejected` states without direct status patching from callback handlers."
- "Add reverification invalidation hooks so reopened fields from request-changes flows can invalidate previously trusted evidence and require re-run verification where appropriate."
- "Enforce verified email as a hard prerequisite before starting or trusting IDV, using authenticated WorkOS auth state or JWT claims rather than diagnostic webhook logs."

## Implementation notes
- `convex/onboarding/brokerApplication/internal.ts` already has `upsertVerificationSnapshot`, `approveApplication`, `rejectApplication`, and `requestChanges`, but no helper currently maps a computed recommendation into those transitions.
- `convex/onboarding/brokerApplication/mutations.ts:submit` currently always transitions to `submitted` and does not invoke any verification recompute or recommendation application.
- `requestChanges` persists reopened fields but does not currently invalidate verification state when identity or licensing inputs reopen.
- `convex/onboarding/verification/actions.ts` only exposes FSRA refresh today. ENG-319 can extend the file with onboarding-access entry points instead of creating route-local provider logic.

## Existing code touchpoints
- `convex/onboarding/brokerApplication/internal.ts`
- `convex/onboarding/brokerApplication/mutations.ts`
- `convex/onboarding/brokerApplication/helpers.ts`
- `convex/onboarding/verification/actions.ts`
- GitNexus: `upsertVerificationSnapshot`, `requestChanges`, and `submit` are all LOW risk with no detected upstream callers/processes in this worktree index.

## Validation
- `bun run test -- src/test/convex/onboarding/verification-runtime.test.ts src/test/convex/onboarding/brokerApplication.aggregate.test.ts`
