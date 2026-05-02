# Chunk Context: chunk-04-public-responsive

## Goal
- Build the unauthenticated public/magic-link view and prove the responsive/access-state requirements.

## Relevant plan excerpts
- "Public/magic-link view must be branded, lightweight, view-only, unauthenticated, and omit platform navigation."
- "Public view must hide downloads unless link policy enables downloads and show neutral inaccessible states for expired/revoked links."
- "Responsive behavior must be dense but approachable: desktop split-pane, tablet collapsible tree/inspector, mobile list-first navigation."

## Implementation notes
- Public route must not use `guardRouteAccess`, `Authenticated`, `AuthLoading`, manager settings, trash, participants, security activity, or old-version UI.
- Bearer-link APIs write access/security events; use mutation-style calls and local loading/error states.
- Inaccessible states should be neutral and avoid revealing whether a private resource exists.
- Reuse visual language from authenticated UI while keeping public surface lighter and view-only.

## Existing code touchpoints
- New file: `src/components/file-workspace/PublicFileViewPage.tsx`.
- Route: `src/routes/files/public/$token.tsx`.
- Backend APIs: `resolveBearerLink`, `listBearerNodes`, `getBearerPreviewUrl`, `getBearerDownloadUrl`.

## Validation
- `bun run test -- src/test/file-workspace/public-file-view.test.tsx src/test/routes/file-workspace-route.test.tsx`
- Browser/screenshot check if a dev server is started for responsive verification.
