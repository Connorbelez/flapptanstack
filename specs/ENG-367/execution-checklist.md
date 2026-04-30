# Execution Checklist: ENG-367 - File Workspace: implement platform policy and Convex-compatible scanner

## Requirements From Linear
- [x] Define `FileScanner.scan(input)` and `FileScanResult` exactly enough for ENG-369 to consume.
- [x] Normalize filenames, rejecting empty names, blocked characters, reserved names, and preserving display names for audit evidence.
- [x] Block executable/script/installer/active HTML and unknown binary formats by default.
- [x] Allow safe business-document families by default: PDF, Office/OpenXML, OpenDocument, CSV, TXT/Markdown, and common images.
- [x] Validate declared MIME/content type against detected magic bytes where detection is available.
- [x] Enforce per-file size and per-box storage quota before a version can become visible.
- [x] Compute SHA-256 for every scanned blob.
- [x] Treat scanner exceptions, missing blobs, and unsafe archive outcomes as blocked `scan_error` or `rejected` per policy.
- [x] Implement platform-admin release for `scan_error` only, requiring a non-empty reason and security/audit evidence.
- [x] Ensure downstream URL consumers can gate preview/download/share on `clean` and `released_by_admin` only.

## Definition Of Done From Linear
- [x] Scanner and policy contracts are implemented and tested.
- [x] Unsafe files remain blocked from preview/download/share consumers.
- [x] `scan_error` release requires platform admin and a reason.
- [x] Rejected files are never releasable in v1.
- [x] Archive behavior is explicitly disabled by default or covered by safe policy tests.
- [x] Existing document-engine upload behavior remains untouched.

## Acceptance Criteria From Plan
- [x] Scanner marks clean files clean and rejected files rejected.
- [x] Scanner failures produce blocked `scan_error`.
- [x] Platform admin can release `scan_error` with reason; non-admin cannot.
- [x] Confirmed rejected files cannot be released.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for scanner policy, filename normalization, MIME/magic bytes, hash, quota, archive-disabled behavior, and scan-state visibility helpers.
- [x] Convex tests added or updated for applying scan results and platform admin release behavior.
- [x] E2E tests are not applicable because this slice has no route/UI workflow.
- [x] Storybook stories are not applicable because this slice has no reusable UI component changes.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] `bun run test -- convex/fileWorkspace src/test/convex/fileWorkspace` passed.
- [x] `bun run test` passed if shared storage/test harness changes require it.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
