# Chunk Context: chunk-01-schema-and-token

## Goal
- Establish the schema and token foundation for hash-only, single-use, expiring guest lawyer invitations.

## Relevant plan excerpts
- "Generate cryptographically random single-use tokens and store only hashes."
- "Expire/invalidate tokens on resend/change/swap."
- "Guest invitations are scoped, expiring, single-use, and token-hash based."

## Implementation notes
- Existing schema already has `lawyerInvitations` with `dealId`, `selectedLawyerSnapshot`, `targetEmail`, `normalizedTargetEmail`, `tokenHash`, `status`, `expiresAt`, acceptance/verification timestamps, `resolvedAuthId`, and `verificationId`.
- Existing `lawyerInvitationStatusValidator` values are `pending`, `accepted`, `verified`, `expired`, `revoked`, and `failed`.
- Token helpers should be pure and testable. Raw tokens may be returned to the caller only at creation/resend time; only the digest is stored.

## Existing code touchpoints
- `convex/schema.ts`
- `convex/legalRepresentation/validators.ts`
- New expected file: `convex/legalRepresentation/tokenUtils.ts`
- GitNexus impact before editing existing schema/validator symbols: planned new helpers avoid existing symbol edits unless schema validation gaps appear.

## Validation
- Targeted token utility tests.
- `bunx convex codegen` after schema or Convex function changes.
