# Spec Audit: ENG-368 - File Workspace: implement boxes, participants, and bearer link backend

- Audit skill: `$linear-pr-spec-audit`
- Review target: branch diff against real base
- Last run: 2026-04-30T17:04:04Z
- Verdict: needs manual validation

## Findings
- No `MISSING` or `CONTRADICTED` implementation requirements found.
- Manual human audit checkpoint remains unexecuted in this local agent run.

## Unresolved items
- Manual checkpoint only: as broker manager create a box, invite viewer/editor/manager, create/revoke/expire links, and confirm public/magic visitors do not see restricted surfaces in downstream UI.

## Next action
- Human/manual validation in a deployed or interactive environment.

## Coverage Summary
- SATISFIED: 23
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 1
- OUT_OF_SCOPE: 4

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | boxes | Authenticated FairLend admins and brokers can create boxes | `convex/fileWorkspace/boxes.ts`, `boxes.test.ts` | Uses fluent `brokerMutation`; tests cover broker and admin creation. |
| SATISFIED | boxes | Creation inserts box, root folder, creator manager, activity, security event | `createBox`, `boxes.test.ts` | Adds `box_created` activity/security event types. |
| SATISFIED | boxes | List participant boxes and platform admin oversight boxes only | `listBoxes`, `listBoxIndex`, tests | Admin oversight does not create participant rows. |
| SATISFIED | auth | `admin:access` oversight does not silently add participant rows | `boxes.test.ts`, `readModels.test.ts` | Explicitly asserted. |
| SATISFIED | participants | Persist user/email grants, role change/removal, duplicate normalized upsert | `participants.ts`, `participants.test.ts` | Revokes instead of hard-delete. |
| SATISFIED | participants | Last manager removal blocked | `removeParticipant`, `participants.test.ts` | No platform override implemented. |
| SATISFIED | links | Generate high-entropy raw tokens and store only hashes | `tokens.ts`, `shareLinks.ts`, `shareLinks.test.ts` | Raw token returned only by create mutation. |
| SATISFIED | links | Public/magic links are revocable, expirable, view-only by default, download-disabled by default | `shareLinks.ts`, `shareLinks.test.ts` | Download availability exposes policy state; file scan gating remains with file download consumers. |
| SATISFIED | access | Disabled/suspended boxes fail closed for normal participants/link visitors | `access.ts`, `shareLinks.ts`, tests | Managers/platform admin retain management visibility where appropriate. |
| SATISFIED | access | Security-sensitive failures avoid private existence leaks | Neutral `FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED` in operations and tests | Expired links use explicit expiry message per source error copy. |
| SATISFIED | access | Central resolver and capability assertion provided for ENG-369 | `resolveFileWorkspacePrincipal`, `assertFileWorkspaceCapability` | Resolver supports authenticated, platform admin, public link, and magic link principals. |
| SATISFIED | read models | UI consumes box index and manager settings read models | `readModels.ts`, `readModels.test.ts` | Link hashes/raw tokens are redacted. |
| SATISFIED | events | Box, participant, and link changes emit security/audit events | `boxes.ts`, `participants.ts`, `shareLinks.ts`, tests | Collaboration activity also emitted for box/participant changes. |
| SATISFIED | tests | Role/link matrix and fail-closed behavior covered | `access.test.ts`, `shareLinks.test.ts`, `readModels.test.ts` | Target File Workspace suite passes. |
| OUT_OF_SCOPE | UI | File routes, workspace UI, public link screen | Linear scope | ENG-370/ENG-371. |
| OUT_OF_SCOPE | files | Upload, move/delete/restore/versioning, secure URLs | Linear scope | ENG-369. |
| OUT_OF_SCOPE | email | Email delivery and email-bound magic links | Linear scope | Explicit non-goal. |
| OUT_OF_SCOPE | ACL | Per-file/per-folder ACL overrides | Linear guardrail | Not implemented. |
| UNVERIFIED | manual checkpoint | Human audit checkpoint in live workflow | Local tests and code review only | Requires interactive/deployed validation. |
