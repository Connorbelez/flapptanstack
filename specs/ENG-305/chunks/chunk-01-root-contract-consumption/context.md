# Chunk Context: chunk-01-root-contract-consumption

## Goal
- Move the portal root from diagnostic/teaser-query consumption to the ENG-303 public landing-page contract, and suppress generic app chrome on public portal root.

## Relevant plan excerpts
- "Replace the current minimal portal-root `/` consumer with the approved production broker landing page."
- "Consume the thin landing-page contract from `ENG-303`."
- "Preserve existing fail-closed host handling from the root portal boundary."
- "The current shared `Header` is generic app chrome and must be bypassed or replaced on the public portal root."

## Implementation notes
- `src/routes/__root.tsx` resolves `portalContext` and blocks unavailable portal hosts before children render; keep this behavior intact.
- `convex/portals/queries.ts:getPublicPortalLandingPage` already returns navigation, hero, trust strip, switchboard, featured listings, and financing strip.
- Root route should pass the current `portalContext.portal.portalId` to the landing query rather than re-resolving host state.
- Non-portal marketing/admin root output can stay minimal because the issue targets valid portal hosts.

## Existing code touchpoints
- `src/routes/index.tsx`: replace `PortalHomeContent` implementation and imports.
- `src/routes/__root.tsx`: add public portal root exception to shared `Header`.
- `src/components/portal/landing/landing-types.ts`: existing frontend contract type.
- GitNexus impact checks to run before code edits: `HomeContent`, `PortalHomeContent`, `RootComponent`.

## Validation
- `python3 scripts/validate_execution_artifacts.py ENG-305 --repo-root "/Users/connor/.codex/worktrees/3f9e/fairlendapp" --stage ready-to-edit`
- Targeted route tests after implementation.
