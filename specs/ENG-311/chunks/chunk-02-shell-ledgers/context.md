# Chunk Context: chunk-02-shell-ledgers

## Goal
- Deliver the command-center page scaffold with named slot hosts, approved section order, and the positions and payment ledgers with route-backed filter/sort controls.

## Relevant plan excerpts
- Slot model from the plan: cockpit slot, positions table, payment activity table, lower limits and export strip slot, suggested opportunities slot, sticky rail host area on the side.
- Key constraints: one `/lender/portfolio` route, positions render before payment activity, payment activity shows individual payments, and this issue consumes upstream DTOs without recalculating financial math locally.
- UX spec: smaller screens collapse decisively, positions stay ahead of suggested opportunities, and the rail content moves inline rather than creating a route-heavy portfolio flow.

## Implementation notes
- Keep cockpit, export strip, suggestions, and sticky rail as explicit slot hosts with placeholder content or host chrome only; do not absorb the downstream leaf rendering owned by later issues.
- Use the command-center contract from `convex/portfolio/contracts.ts` for section counts, empty states, and placeholder host copy so the page stays aligned to the upstream DTOs.
- Implement the positions and payment tables as first-class ledger sections with route-backed text filter and status/sort controls instead of local ad hoc component state.
- Keep sticky-rail hosting responsive: side column on desktop, inline host placement on smaller screens.

## Existing code touchpoints
- `convex/portfolio/contracts.ts`: `portfolioCommandCenterValidator` defines the exact route payload shape, including positions, payment activity, actions, limits, suggestions, and broker coordination.
- `src/components/ui/table.tsx`, `src/components/ui/card.tsx`, `src/components/ui/empty.tsx`, `src/components/ui/select.tsx`, and `src/components/ui/badge.tsx`: existing shadcn primitives that fit the approved shell and ledger treatment.
- `src/components/listings/query-options.ts` and `src/components/admin/financial-ledger/search.ts`: current repo examples for route-backed filter/sort wiring.
- `src/hooks/use-mobile.ts`: shared mobile breakpoint hook that will also drive the responsive rail host placement.

## Validation
- `src/test/routes/lender-portfolio-route.test.tsx` should prove section ordering, empty-state-safe rendering, and route-backed filter/sort behavior.
- `bun typecheck` must pass for the new portfolio component props and formatter utilities.
