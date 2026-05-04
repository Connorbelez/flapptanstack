# Chunk Context: chunk-02-backend-operations

## Goal
- Implement availability management, SLA management, checkout platform lawyer projections, SLA breach escalation, periodic restriction rechecks, and cron registrations.

## Relevant plan excerpts
- "SLA timer starts when documents are assigned or when deal enters documentReview.pending with selected platform lawyer, whichever the implementation determines from existing document package state."
- "SLA breach creates an admin action/escalation and updates metrics; it does not automatically mutate deal status."
- "Periodic restriction recheck creates lawyerVerifications rows with checkType platform_periodic."

## Implementation notes
- Use `documentReview.pending` status observation for SLA start in this slice; there is no dedicated document assignment timestamp in the current legal representation schema.
- Use `recordLawyerVerificationRow` for immutable evidence writes.
- Use indexed profile/status and SLA/recheck tables for bounded batch jobs.
- Admin-only operations should use existing fluent admin builders; lawyer self-service availability should verify auth ownership.

## Existing code touchpoints
- `convex/legalRepresentation/availability.ts` (new)
- `convex/legalRepresentation/sla.ts` (new)
- `convex/legalRepresentation/platformLawyers.ts` (new)
- `convex/legalRepresentation/verifications.ts`
- `convex/crons.ts`
- `convex/lib/businessDays.ts`

## Validation
- Targeted legalRepresentation backend tests
- `bunx convex codegen`
- `bun typecheck`
