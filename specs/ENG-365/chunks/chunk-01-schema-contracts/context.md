# Chunk Context: chunk-01-schema-contracts

## Goal
- Add the durable schema and validator contract needed by availability, SLA, capacity, restriction recheck, and escalation work.

## Relevant plan excerpts
- "Availability is weekly recurring windows plus exception/hold records, not ad hoc text on lawyer profile."
- "SLA tiers are admin-configurable and assigned to platform lawyer profiles."
- "Periodic restriction recheck creates lawyerVerifications rows with checkType platform_periodic and can mark platform profile suspended/requires_review."
- "Cron jobs must be idempotent and bounded; avoid full-table scans without indexes/pagination."

## Implementation notes
- Current legal representation schema has `lawyerProfiles`, `lawyerVerifications`, `lawyerInvitations`, and `representationEngagements`.
- Additive tables are preferred because the project is greenfield but existing legal evidence semantics should remain immutable.
- Add `requires_review` to platform profile status because the issue explicitly requires it and current validator only supports `invited`, `active`, `suspended`, and `offboarded`.

## Existing code touchpoints
- `convex/legalRepresentation/validators.ts`
- `convex/schema.ts`
- GitNexus: existing edited symbols checked as LOW impact where applicable.

## Validation
- `bunx convex codegen`
- targeted schema/contract tests after implementation
