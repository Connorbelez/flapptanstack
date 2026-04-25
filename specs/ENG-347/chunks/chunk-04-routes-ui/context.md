# Chunk Context: chunk-04-routes-ui

## Goal
- Build the lawyer route tree and UI surfaces that consume server projections and lawyer mutations.

## Relevant plan excerpts
- `/lawyer` must use the authenticated parent-layout pattern before suspense query children render.
- Add assigned closings entry route plus deal workspace route.
- Queue groups: Needs Representation Confirmation, Needs Package Review, Awaiting Signers, Completed.
- Workspace panels: Matter Overview, Package Review, Signers & Order, Timeline.
- Active action buttons must disappear or be disabled with explicit reasons in completed/ended-role states.

## Implementation notes
- Preserve `guardRouteAccess("lawyer")`.
- Use `Authenticated` and `AuthLoading` from `convex/react`; mirror `src/routes/listings/route.tsx`.
- Use generated Convex API hooks for lawyer projections/actions.
- Keep UI quiet, work-focused, and dense enough for backoffice use.
- Do not add admin, funds, or exception resolution controls.
- Use `useAuth` from `@workos/authkit-tanstack-react-start/client` only if UI needs auth state directly.

## Existing code touchpoints
- `src/routes/lawyer/route.tsx`.
- New `src/routes/lawyer/index.tsx`.
- New `src/routes/lawyer/deals.$dealId.tsx`.
- New `src/components/lawyer/deals/LawyerAssignedClosingsPage.tsx`.
- New `src/components/lawyer/deals/LawyerDealWorkspacePage.tsx`.
- Existing route pattern: `src/routes/listings/route.tsx`, `src/routes/listings/index.tsx`.
- UI precedent: `src/components/lender/deals/LenderDealDetailPage.tsx` for package display only, not auth/action semantics.

## Validation
- Route/component tests for queue, workspace panels, action states, missing-contract blockers, access revocation while open, package failure, envelope exception, and reissue history.
- Browser/Playwright screenshot checks if substantial layout changes need visual verification.
- `bun check`.
- `bun typecheck`.
