# Chunk Context: chunk-02-backend-lifecycle

## Goal
- Implement the Convex invitation lifecycle, WorkOS identity resolution boundary, verification evidence, and provisional access migration.

## Relevant plan excerpts
- "Resolve existing lawyer profile by verified WorkOS auth ID, normalized email, and bar/jurisdiction evidence before provisioning a new one."
- "Existing `dealAccess.userId = normalizedEmail` provisional row is revoked or supplemented by `dealAccess.userId = resolvedAuthId` with role `guest_lawyer`."
- "Migration is idempotent and auditable; repeated callback cannot create duplicate access or duplicate WorkOS users."
- "On successful verification, create immutable lawyerVerifications evidence and mark invitation verified."

## Implementation notes
- Follow fluent-convex for exported queries/mutations/actions and end each export with `.public()` or `.internal()`.
- Use existing `grantDealAccess` idempotent helper where possible.
- Prefer local helper functions and injected resolver/provider dependencies so WorkOS behavior is mockable.
- Do not modify deal status or emit `LAWYER_VERIFIED` here unless the existing transition boundary explicitly supports it with evidence.

## Existing code touchpoints
- `convex/legalRepresentation/invitations.ts` will likely be new.
- `convex/legalRepresentation/profiles.ts` has profile upsert and canonical WorkOS role checks for platform lawyers; guest resolution should avoid duplicating profile rows.
- `convex/legalRepresentation/verifications.ts` has immutable evidence row helpers.
- `convex/deals/mutations.ts::grantDealAccess` LOW risk; direct callers are deal locks, deals mutations, and engine dealAccess effects.
- `convex/auth/resourceChecks.ts::canAccessDeal` LOW risk; feeds transfer/document access. Preserve email bridge until migration completes.

## Validation
- Backend tests for create/resend/revoke/accept/verify.
- Backend tests for duplicate identity/profile prevention.
- Backend tests for access migration idempotency and resource check compatibility.
