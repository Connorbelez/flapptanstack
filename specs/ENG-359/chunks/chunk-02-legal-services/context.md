# Chunk Context: chunk-02-legal-services

## Goal
- Provide typed helpers and provider contracts so downstream issues import shared legal-representation logic instead of duplicating local assumptions.

## Relevant plan excerpts
- `LawyerVerificationProvider` accepts normalized lawyer identity, LSO reference, deal context, and check type; returns typed outcome with reason codes and source snapshot.
- Helpers must decide whether verification blocks selection, LAWYER_VERIFIED, REPRESENTATION_CONFIRMED, or platform activation.
- Verification evidence is immutable and queryable by deal, lawyer profile/auth ID, check type, and expiry/currentness.

## Implementation notes
- New files expected under `convex/legalRepresentation/`: `normalization.ts`, `providers.ts`, `verifications.ts`, `fixtures.ts`, and possibly `index.ts`.
- Internal/public Convex endpoints, if any are needed, must use fluent-convex builders and explicit `.internal()` or `.public()`.
- Prefer pure helpers for checkpoint decisions so tests can cover downstream behavior without database setup.

## Existing code touchpoints
- Immutable/idempotent evidence patterns: `convex/deals/closeEvidence.ts`.
- Fluent builder pattern: `convex/fluent.ts` and modules such as `convex/documentEngine/dataModelEntities.ts`.
- Generated `Id`/`Doc` types from `convex/_generated/dataModel`.

## Validation
- Unit tests for normalization, provider result handling, currentness, and checkpoint decisions.
- Convex tests for immutable row insert/query helpers where DB access is introduced.
