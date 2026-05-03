# Chunk Context: chunk-04-security-retention

## Goal
- Cover manager security workflows, denied role attempts, retention-blocked deletion, and scan-error release evidence.

## Relevant plan excerpts
- `e2e/file-workspace/security-and-retention.spec.ts`: participants, denials, scan release, retention-blocked deletion.
- Scan release may be E2E or integration test; must prove platform admin can release `scan_error` with reason and non-admin cannot.

## Implementation notes
- Use manager-owned, editor-owned, viewer-owned, and scan-error fixtures from the helper.
- Prefer backend evidence for audit/security records when the UI does not yet expose the full security feed.
- Do not expose public visitor or lower-role management surfaces to satisfy a test.

## Existing code touchpoints
- `convex/fileWorkspace/participants.ts`
- `convex/fileWorkspace/nodes.ts`
- `convex/fileWorkspace/retention.ts`
- `convex/fileWorkspace/scanMutations.ts`
- `src/components/file-workspace/ShareSettings.tsx`

## Validation
- `bun run test:e2e -- e2e/file-workspace/security-and-retention.spec.ts`
- `bun run test -- convex/fileWorkspace`
