# Chunk Context: chunk-03-detail-hosts

## Goal
- Deliver the position and payment detail hosts that open from ledger row clicks as desktop sheets and mobile drawers, using the existing portfolio detail contracts.

## Relevant plan excerpts
- Requirement 7 from Linear: clicking a position row must open a full-height right-side sheet host on desktop and a drawer on mobile.
- Requirement 8 from Linear: clicking a payment row must open a full-height right-side sheet host on desktop and a drawer on mobile.
- Approved mock excerpt: "desktop row interactions use full-height right-side sheets, sheets fully overlap the page and sticky rail, mobile uses the drawer pattern, and nested card-heavy sidebars were explicitly rejected."

## Implementation notes
- Keep detail selection route-owned via search state so opening and closing detail hosts does not create parallel local state machines.
- Use the existing `convex/portfolio/queries.ts` position and payment detail endpoints through the new query-option seam; do not re-derive detail data from the command-center snapshot.
- Prefer class overrides on `SheetContent` / `DrawerContent` for the approved width and height before considering any shared primitive edit.
- Keep the sheet bodies single-column with stacked sections, lightweight tabs, label/value rows, and divider-based grouping.

## Existing code touchpoints
- `convex/portfolio/queries.ts`: exposes `getLenderPortfolioPositionDetail` and `getLenderPortfolioPaymentDetail`.
- `src/components/ui/sheet.tsx` and `src/components/ui/drawer.tsx`: existing primitives to host the detail surfaces.
- `src/components/demo/crm/RecordSidebar.tsx` demonstrates a wide right-side sheet using `SheetContent className="w-full ... sm:max-w-2xl"`.
- GitNexus context on `ListingGridShell` confirms the existing repo pattern for responsive desktop/mobile surface switching relies on `useIsMobile`.

## Validation
- `src/test/routes/lender-portfolio-route.test.tsx` should prove position and payment row selection opens the correct detail host on desktop and mobile.
- `bun typecheck` must pass for the responsive detail host props and detail contract types.
