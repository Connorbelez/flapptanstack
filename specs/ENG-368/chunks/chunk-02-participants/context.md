# Chunk Context: chunk-02-participants

## Goal
- Deliver participant invite/upsert/list/remove backend behavior with access-change events.

## Relevant plan excerpts
- Participant invites persist user/email grants, support role changes/removal, and write activity/security events.
- Duplicate invite for same normalized email/user updates one grant instead of creating ambiguous grants.
- Last manager removal is blocked unless platform admin override is explicitly implemented and audited.

## Implementation notes
- Participant keys should be normalized as `auth:<authId>` or `email:<lowercase email>`.
- Only managers and platform admins can manage participants.
- Role inputs must validate against the fixed `viewer | editor | manager` union.
- Removal should revoke rather than hard-delete by setting status/revoked fields so audit history remains queryable.

## Existing code touchpoints
- New file: `convex/fileWorkspace/participants.ts`.
- Shared helper candidate: participant key normalization in `convex/fileWorkspace/operations.ts`.
- Existing schema index `by_box_participant_status` supports duplicate/upsert lookups.

## Validation
- Participant tests in `convex/fileWorkspace/__tests__`.
- Later full gates: `bunx convex codegen`, `bun check`, `bun typecheck`.
