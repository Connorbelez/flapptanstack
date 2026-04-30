# Chunk Context: chunk-02-convex-scan-state

## Goal
- Persist scan outcomes safely and expose the platform-admin release path for `scan_error` only.

## Relevant plan excerpts
- Add action wrapper and internal mutation to apply results idempotently.
- Platform admin can release `scan_error` with reason; non-admin cannot.
- Confirmed rejected files cannot be released.
- Scan retry must not create duplicate versions or promote stale results.

## Implementation notes
- Use fluent-convex export style with explicit `.public()` or `.internal()`.
- `scanActions.ts` should read Convex storage blobs, run the default scanner, then call the internal mutation to apply results.
- `scanMutations.ts` should patch only pending/current matching versions and write `fileSecurityEvents` evidence for state changes and release.
- Public admin release should use `adminMutation` to enforce FairLend platform admin.

## Existing code touchpoints
- `convex/fluent.ts`: use `authedAction`, `adminMutation`, and related fluent patterns.
- `convex/fileWorkspace/securityEvents.ts`: use actor/security event helpers where helpful.
- `convex/schema.ts`: no schema change expected; existing `fileVersions` has scan and release fields.

## Validation
- `bun run test -- convex/fileWorkspace`
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
