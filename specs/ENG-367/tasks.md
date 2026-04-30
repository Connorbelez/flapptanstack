# Tasks: ENG-367 - File Workspace: implement platform policy and Convex-compatible scanner

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, Notion plan, supporting goal spec, comments, and repo instructions.
- [x] T-002: Confirm ENG-366 File Workspace schema/contracts are present.
- [x] T-003: Run GitNexus impact/context for referenced existing symbols and record blast radius.
- [x] T-004: Validate execution artifacts at `ready-to-edit`.

## Phase 2: Policy and Scanner
- [x] T-010: Create `convex/fileWorkspace/policy.ts` with default allowed/blocked policy, extension helpers, archive-disabled gate, quota helpers, and visibility gate helper.
- [x] T-020: Create `convex/fileWorkspace/scanner.ts` with `FileScanner`, `FileScanResult`, structural scanner, SHA-256 helper, and MIME/magic-byte detection.
- [x] T-030: Add focused policy/scanner unit tests under `convex/fileWorkspace/__tests__`.

## Phase 3: Convex Scan State
- [x] T-110: Create `convex/fileWorkspace/scanMutations.ts` with internal scan-result application and platform-admin `scan_error` release mutation.
- [x] T-120: Create `convex/fileWorkspace/scanActions.ts` with a Convex storage action wrapper that reads blobs and invokes the default scanner.
- [x] T-130: Add Convex tests for clean, rejected, scan_error, stale result, admin release, non-admin denial, and rejected release denial.

## Phase 4: Validation and Audit
- [x] T-900: Run `bunx convex codegen`.
- [x] T-910: Run `bun check`.
- [x] T-920: Run `bun typecheck`.
- [x] T-930: Run targeted File Workspace tests.
- [x] T-940: Run broader `bun run test` if shared harness behavior changed.
- [x] T-950: Run `$linear-pr-spec-audit` and persist verdict in `audit.md`.
- [x] T-960: Resolve audit findings or record blockers.
- [x] T-970: Run final execution artifact validation.
- [x] T-980: Run GitNexus detect changes.
