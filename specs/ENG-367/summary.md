# Summary: ENG-367 - File Workspace: implement platform policy and Convex-compatible scanner

- Source issue: https://linear.app/fairlend/issue/ENG-367/file-workspace-implement-platform-policy-and-convex-compatible-scanner
- Primary plan: https://www.notion.so/350fc1b4402481f68855cef254c9a4cb
- Supporting docs:
  - https://www.notion.so/350fc1b4402480efa2f0c395b89fa1d6

## Scope
- Create the injectable File Workspace scanner and policy layer for upload/version operations.
- Implement pure TypeScript filename, extension, MIME/magic-byte, size/quota, archive-disabled, and SHA-256 scan behavior.
- Add Convex action/mutation wrappers for reading storage blobs, applying scan results idempotently, and releasing `scan_error` versions by platform admin with a reason.
- Add scanner, policy, scan-state, and release tests.

## Constraints
- ENG-366 contracts are present: `fileBoxes`, `fileNodes`, `fileVersions`, `fileSecurityEvents`, scan policy validators, scan-state unions, and release metadata.
- No paid scanner APIs, no third-party scanner services, and no host-installed binary dependency.
- Files remain blocked until scan state is `clean` or `released_by_admin`.
- Confirmed `rejected` files are not releasable in v1.
- Archives stay disabled by default unless a safe Convex-compatible inspector is selected; this issue will ship default archive rejection.
- Existing document-engine upload helpers are reference patterns only and must remain untouched.

## GitNexus Findings
- `documentUploadAction`, `documentUploadMutation`, `extractPdfMetadata`, and `auditLog` impact checks: LOW risk, no direct dependents reported.
- `AuditTrail` impact check: MEDIUM risk, 37 impacted relationships; no edits planned to `AuditTrail`.
- File Workspace query found no existing scanner flow; implementation is additive under `convex/fileWorkspace`.

## Open questions
- No blocking open question. Archive inspection remains intentionally disabled by default for v1.
