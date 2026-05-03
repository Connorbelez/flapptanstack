# Chunk Context: chunk-03-public-links-e2e

## Goal
- Prove public and magic-link routes are unauthenticated, view-only, policy-aware, and fail closed.

## Relevant plan excerpts
- `e2e/file-workspace/public-links.spec.ts`: public and magic link view-only access, download policy, expired/revoked links.
- Public visitor must not see platform navigation, upload, comment write, participant list, security feed, trash, old versions, or settings.

## Implementation notes
- Use a signed-out browser context for bearer link tests.
- Assert neutral inaccessible state for expired, revoked, and tampered tokens.
- Download controls should be hidden or disabled unless both link and box policies allow download.

## Existing code touchpoints
- `src/routes/files/public/$token.tsx`
- `src/components/file-workspace/PublicFileViewPage.tsx`
- `convex/fileWorkspace/shareLinks.ts`, `readModels.ts`, and `versions.ts`

## Validation
- `bun run test:e2e -- e2e/file-workspace/public-links.spec.ts`
