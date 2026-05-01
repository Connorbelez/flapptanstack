# Chunk Context: chunk-01-backend-projection-actions

## Goal
- Deliver the backend status projection, server-authorized management actions, and query exposure needed by lender/admin UI.

## Relevant plan excerpts
- "Add status projection for platform selected, confirmation requested, confirmed, guest invitation sent, accepted, verified, restriction check, blocked, expired, and revoked states."
- "Re-send invitation: Available when guest lawyer hasn't accepted the magic link. Sends fresh email. Does not reset the 72h expiry from original invite."
- "Select different lawyer: Available at any point before lawyer confirms. Revokes the current lawyer's dealAccess record (if created), creates a new selection."
- "Do not mutate deal status except through the Transition Engine."

## Implementation notes
- Projection must be backend-derived from deal, invitations, verifications, engagements, access, and ENG-363 gate results.
- Replacement policy for this slice rejects deals at or after `lawyerOnboarding.verified`; no backward state-machine event is added.
- Resend rotates the token for pending invitations but preserves expiry.
- Change-email invalidates current invitations and creates a new pending invitation for the normalized target email.
- Audit events should use `appendAuditJournalEntry` so actor, timestamp, previous/new state, and lawyer references are queryable.

## Existing code touchpoints
- `convex/legalRepresentation/invitations.ts`: existing guest invitation create/resend/revoke/accept flows.
- `convex/legalRepresentation/gates.ts`: ENG-363 gate result and reason evaluation.
- `convex/legalRepresentation/engagements.ts`: signed engagement helpers; add supersede/void pending evidence helper if needed.
- `convex/deals/mutations.ts`: existing access helpers and admin deal mutations.
- `convex/deals/queries.ts`: lender/admin deal projections.
- GitNexus impact checks in progress/completed for `grantDealAccess`, `revokeAccess`, `evaluateDealLegalGate`, `getParticipantDealWorkspace`, and `getAdminDealOperationsDetail`.

## Validation
- `python3 scripts/validate_execution_artifacts.py ENG-364 --repo-root "/Users/connor/.codex/worktrees/3905/fairlendapp" --stage ready-to-edit`
- Targeted backend tests after implementation.
