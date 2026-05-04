# Spec Audit: ENG-365 - Legal representation: add platform availability, SLA, and restriction rechecks

- Audit skill: `$linear-pr-spec-audit`
- Review target: local working tree diff for ENG-365
- Last run: 2026-05-01T02:30:00-04:00
- Verdict: ready

## Findings
- none

## Unresolved items
- none

## Next action
- Hand off for human review with the unrelated full-suite failures called out separately from ENG-365.

## Requirement Ledger
- SATISFIED: Platform availability windows and dated hold/exception records are modeled in `platformLawyerAvailabilityWindows` and `platformLawyerAvailabilityExceptions`.
- SATISFIED: Admin SLA tiers and platform lawyer assignments are modeled in `platformLawyerSlaTiers` and `platformLawyerAssignments`.
- SATISFIED: Checkout option projection includes active deal count, capacity limit, capacity warning, SLA tier, and the next business-day availability.
- SATISFIED: Listing checkout card shows name, firm, SLA tier, availability, active deal count, and warning text while preserving over-capacity selection.
- SATISFIED: Backend checkout validation blocks suspended, restricted, requires-review, held, or unavailable platform lawyers.
- SATISFIED: SLA reviews are created from pending document review state and breach escalations are idempotent.
- SATISFIED: Metrics table tracks average turnaround, SLA compliance, completed/active deal counts, and breach count.
- SATISFIED: Periodic restriction rechecks write immutable verification/recheck evidence, suspend or mark review-required lawyers, block new selection, and leave active deal access intact while creating review escalations.
- SATISFIED: Targeted Convex and React tests cover projection, permissions/selection behavior, cron idempotency, and checkout display.

## Evidence
- Schema/domain records: `convex/schema.ts`
- Availability operations: `convex/legalRepresentation/availability.ts`
- Platform lawyer checkout and assignment operations: `convex/legalRepresentation/platformLawyers.ts`
- SLA and restriction jobs: `convex/legalRepresentation/sla.ts`
- Cron registration: `convex/crons.ts`
- Checkout backend enforcement: `convex/checkout/mutations.ts`
- Listing projection and UI: `convex/listings/marketplace.ts`, `src/components/listings/ListingDetailPage.tsx`, `src/components/listings/marketplace-detail-adapter.ts`
- Tests: `convex/legalRepresentation/__tests__/availabilitySla.test.ts`, `src/test/listings/listing-detail-checkout.test.tsx`

## Validation Notes
- `bunx convex codegen`: passed.
- `bun check`: passed; existing repository warnings remain outside this slice.
- `bun typecheck`: passed.
- Targeted tests: passed for legal representation SLA/availability and listing checkout/detail coverage.
- Full `bun run test`: run for broader validation; still fails on unrelated pre-existing portal, WorkOS webhook/env, velocity, and cash ledger tests. One listing regression found by the full suite was fixed and rerun through targeted tests.
- GitNexus index refreshed with `npx gitnexus analyze`; `npx gitnexus status` reports the index up to date at current commit `2c35508`. No callable `gitnexus_detect_changes` tool or CLI command by that exact name was available in this session, so change scope was checked with the refreshed index plus local diff scope.
