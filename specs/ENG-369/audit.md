# Spec Audit: ENG-369 - File Workspace file tree, versioning, upload, retention, and secure URLs

- Audit skill: `$linear-pr-spec-audit`
- Review target: local branch diff against current base commit `d41a3f1`
- Last run: 2026-05-01T01:22:00Z
- Verdict: needs manual validation

## Top Findings

No remaining ENG-369 spec-compliance findings found in the File Workspace slice after remediation.

The prior audit blockers were addressed:

1. Editors can restore deleted nodes when retention policy allows.
2. Upload finalize and replacement schedule the scan action.
3. Same-name upload finalization now creates a replacement version instead of failing duplicate-name validation.
4. Permanent delete is retention-gated, writes blocked evidence without rolling back, and recursively removes folder descendants and their versions.
5. Preview/download denials for blocked versions and disabled downloads now commit security events by returning explicit denied results instead of throwing after journaling.
6. Direct tests now cover editor restore, scan scheduling, finalize-as-replacement, restore-as-new-current, retention-blocked permanent delete evidence, recursive permanent delete, and public/bearer URL denial journaling.

## Requirement Ledger

| Requirement | Status | Evidence |
| --- | --- | --- |
| File tree lists folders/files with breadcrumbs/path derivation | SATISFIED | `convex/fileWorkspace/readModels.ts` derives breadcrumbs and path display for authenticated and bearer tree reads. |
| Create folder with same-parent uniqueness | SATISFIED | `convex/fileWorkspace/nodes.ts` validates active folder parent and sibling name uniqueness. |
| Rename and move with same-box/cycle guards | SATISFIED | `renameNode` and `moveNode` validate capabilities, target parent, duplicate siblings, and descendant cycles. |
| Soft delete hides descendants from normal and public views | SATISFIED | `markNodeDeleted` plus `hasDeletedAncestor` filtering prevents deleted subtrees from listing. |
| Editors and managers can restore from trash when policy allows | SATISFIED | `restoreNode` evaluates restore retention policy and editor-like access without requiring manager-only trash access. |
| Retention-blocked permanent delete writes evidence and refuses deletion | SATISFIED | Blocked delete returns a blocked result after writing `retention_delete_blocked`, preserving the journaled event. |
| Permanent folder delete removes descendants | SATISFIED | `permanentlyDeleteNode` collects the node subtree and deletes descendant versions and nodes. |
| Storage-delete failure leaves metadata retryable | SATISFIED | Permanent delete deletes storage blobs before deleting version/node metadata, so failed storage deletion leaves metadata available for retry. |
| Upload finalize creates or replaces a file and immutable pending-scan version | SATISFIED | `finalizeUpload` creates a new file or appends a new version to an existing same-name file. |
| Upload finalize and replacement schedule scanning | SATISFIED | `scheduleFileWorkspaceScan` schedules `fileWorkspace/scanActions:scanVersion` for finalize and replacement. |
| Replacement preserves previous current until clean/released | SATISFIED | Replacement inserts pending versions; scan mutations promote only clean/released results. |
| Version listing is role-aware | SATISFIED | Managers/editors see version history; viewers are limited to current visible versions. |
| Restore old version as new current version | SATISFIED | `restoreVersionAsCurrent` creates a new visible version and promotes it; covered by tests. |
| Secure preview/download URLs only for clean or released versions | SATISFIED | Pending/rejected/missing current versions return denied results without issuing URLs. |
| Secure URL denials write security feed events | SATISFIED | Blocked-version, deleted/missing-node, and disabled-download URL denials write security events and return denied results. |
| Public/magic-link reads return permitted listing/preview/download only | SATISFIED | Bearer listing and URL paths enforce link policy, box policy, deleted ancestors, and scan visibility. |
| Comments are file-scoped | SATISFIED | Comment creation/listing requires a file node in the selected box. |
| Tags are box-scoped | SATISFIED | Tag creation normalizes names by box, and assignment validates tag/node box consistency. |
| Collaboration activity records upload, new version, rename, move, comment, tag, delete, restore | SATISFIED | The implemented operations write activity records for these lifecycle actions. |
| Security/manager feed records access/download/preview/scan/retention/denial events | SATISFIED | Security event helpers and URL/scan/retention/link paths write the required event classes covered in this slice. |
| Validation commands pass | PARTIAL | File Workspace tests, typecheck, and codegen pass. Repo-wide `bun check` and `bun run test` are still blocked by unrelated existing diagnostics/timeouts outside File Workspace. |

## Validation Evidence

- PASS: `bunx convex codegen`
- PASS: `bun typecheck`
- PASS: `bun run test -- convex/fileWorkspace` - 12 files, 57 tests
- PASS: `bunx biome check convex/fileWorkspace convex/test/moduleMaps.ts specs/ENG-369 --write`
- BLOCKED: `bun check` due existing complexity diagnostics outside File Workspace
- BLOCKED: `bun run test` due unrelated timeout in `src/test/convex/payments/rotessaManagedRecurringLifecycle.test.ts`
- UNAVAILABLE: `npx gitnexus detect-changes --repo fairlendapp`; this GitNexus CLI exposes no `detect-changes` command, and tool discovery did not expose a GitNexus MCP change-detection tool.

## Verdict

Needs manual validation only because repo-wide gates remain blocked outside ENG-369. The File Workspace implementation now satisfies the previously audited ENG-369 findings and its targeted validation passes.
