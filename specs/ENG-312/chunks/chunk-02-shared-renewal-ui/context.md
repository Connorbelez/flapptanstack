# Chunk Context: chunk-02-shared-renewal-ui

## Goal
- Build shared renewal-specific presentation and interaction components, then mount them inside the rail item host and the position sheet so both surfaces stay aligned.

## Relevant plan excerpts
- "Render renewal-specific action items inside the generic Actions Required host from ENG-329."
- "Render renewal state and actions inside the position sheet host from ENG-311."
- "Expired or matured intents remain visible but non-actionable."
- "Publish shared renewal-specific components so the rail host and sheet host cannot drift."

## Implementation notes
- Keep the rail shell and sheet host intact; only the renewal-specific content inside those hosts changes in this issue.
- Use one shared component family with compact and full variants rather than duplicating logic in `actions-rail.tsx` and `position-sheet.tsx`.
- Preserve existing broker-prefill and detail-host behavior while adding governed renewal affordances.
- Reuse existing ShadCN primitives and avoid route-heavy navigation or card-heavy sidebars.

## Existing code touchpoints
- `src/components/lender/portfolio/action-item-host.tsx` is the generic action item shell where renewal-specific content can branch from `renewal_prompt`.
- `src/components/lender/portfolio/actions-rail.tsx` mounts `ActionItemHost` and should remain the generic host surface.
- `src/components/lender/portfolio/position-sheet.tsx` currently exposes summary data and placeholder quick actions for renewal content.
- `src/components/lender/portfolio/LenderPortfolioPage.tsx` mounts both the rail and the position sheet and is the shared integration seam.
- Local dependency tracing shows these components are only consumed from the lender portfolio route and its focused tests.

## Validation
- `bun run test -- src/test/lender/portfolio-renewals.test.tsx`: not-run
- `bun run test -- src/test/lender/portfolio-rail.test.tsx`: not-run
- `bun run test -- src/test/routes/lender-portfolio-route.test.tsx`: not-run
