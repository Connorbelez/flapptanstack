# Chunk Context: chunk-02-sync-normalization

## Goal
- Build the full-deal fetch client and shared normalization/readiness logic used by webhook, manual sync, and later mock-harness triggers.

## Relevant plan excerpts
- Full deal fetch: `GET /v1/deals?apikey=<uuid>&loancode=<loanCode>`.
- Prefer `loanCode` against Deals Out; tolerate the supplied webhook `deal` href as an opaque fallback only when Newton supplies it.
- Boundary validators should be permissive at the upstream boundary and strict at the normalized/readiness boundary.
- `normalizedHash` must be stable over Velocity-owned core facts only, excluding FairLend-owned enrichment and activation state.

## Implementation notes
- Add an injected fetch/client seam so tests can provide Velocity responses without live network calls.
- Preserve raw response body and raw deal JSON for sync attempts and snapshots.
- Normalize into `VelocityNormalizedCoreV1` from `convex/velocity/contracts.ts`.
- Use existing mappings in `convex/velocity/constants.ts` for status, payment frequency, rate type, province, intended use, and status semantics.
- Required-core-field blockers should be explicit and field-path specific.
- Readiness should explain unsupported payment mappings, non-funded status, `Complete (7)` before activation, missing FairLend-owned bank/PAD/remediation inputs, and final-review drift inputs.

## Existing code touchpoints
- `convex/velocity/contracts.ts`: DTO interfaces to target.
- `convex/velocity/constants.ts`: mapping helpers and status/idempotency helpers.
- `convex/velocity/validators.ts`: normalized core/readiness validators.
- New planned files: `convex/velocity/client.ts`, `convex/velocity/sync.ts`.
- GitNexus impact checks to run before edits: `mapVelocityPaymentFrequencyToFairLend`, `mapVelocityRateTypeToFairLend`, `resolveVelocityStatusSemantics`, `getVelocityCanadianProvince`.

## Validation
- Unit tests for fetch-by-loan-code request construction, href fallback, normalization hashes, unsupported payment frequency blockers, and status readiness semantics.
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
