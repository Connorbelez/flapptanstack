# Execution Checklist: ENG-368 - File Workspace: implement boxes, participants, and bearer link backend

## Requirements From Linear
- [x] Allow authenticated FairLend admins and brokers to create boxes.
- [x] Box creation must insert `fileBoxes`, one root `fileNodes` folder, creator `fileBoxParticipants` as `manager`, a collaboration activity event, and a security/audit event.
- [x] List only boxes where the authenticated user is a participant or where platform admin oversight applies.
- [x] Enforce role capabilities: viewer can list/preview/comment-read/activity-read and download only when policy allows; editor adds upload/create-folder/rename/move/tag/comment/new-version/soft-delete; manager adds settings/participant/link/retention/scan-release/permanent-delete-request rights.
- [x] `admin:access` grants platform oversight but must not silently add admins as participants.
- [x] Participant invites must persist user/email grants, support role changes/removal, and write activity/security events.
- [x] Link tokens must be generated with enough entropy, stored hashed only, and raw tokens returned only once at creation.
- [x] Public and magic links are view-only by default, revocable, expirable, and download-disabled unless explicit policy enables downloads.
- [x] Disabled/suspended boxes must fail closed for normal participants and link visitors.
- [x] Security-sensitive errors must not reveal private box/link existence to unauthorized principals.

## Definition Of Done From Linear
- [x] Boxes, participants, and links are fully represented by fluent-convex functions.
- [x] Role and link access matrix is tested and fail-closed.
- [x] Link tokens are stored hashed only.
- [x] Audit/security events are emitted for box, participant, and link changes.
- [x] ENG-369 can consume the access resolver without adding local ad hoc permission logic.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated where backend or domain logic changed.
- [x] E2E tests added or updated where an operator or user workflow changed.
  - ENG-368 plan delegates browser journeys to ENG-371 unless auth wiring requires local proof.
- [x] Storybook stories added or updated where reusable UI changed.
  - No UI or reusable component changes are planned for ENG-368.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests, and broader `bun run test` if shared auth/policy changes occur.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
