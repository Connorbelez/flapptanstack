# Spec Compliance Review: ENG-301

- Audit skill: `$linear-pr-spec-audit`
- Review target: local ENG-301 worktree delta against `eng-300`
- Governing sources: Linear issue `ENG-301` plus linked Notion implementation-plan, technical-design, and architecture pages
- Last run: 2026-04-20 22:45 EDT

## Findings
- [medium] No material `MISSING` or `CONTRADICTED` gaps were found against the ENG-301 contract. The remaining gap is live proof, not code shape: this worktree now has explicit portal query wrappers, server-side lender filter clamping, thin route consumers wired off root `portalContext`, production listing UI reuse, and targeted automated coverage, but the issue's real-browser checkpoint is still unclosed. There is no focused Playwright flow for broker portal listings in this checkout, and `bun run test:e2e` was not rerun as part of this audit.

## Verdict
- needs manual validation

## Coverage Summary
- SATISFIED: 8
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 2

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | backend contract | Ship an explicit public portal listings query on portal-aware server context | `convex/listings/portalQueries.ts` | `listPublicPortalListings` is exported via `portalPublicQuery`, returns teaser metadata, and requires portal pricing before projecting results. |
| SATISFIED | backend contract | Ship explicit authenticated lender portal list/detail queries with same-portal access boundaries | `convex/listings/portalQueries.ts` | `listLenderPortalListings` and `getLenderPortalListingDetail` are exported via `portalLenderQuery`, keeping portal access checks in backend middleware instead of route code. |
| SATISFIED | filtering | Clamp lender-facing filters from `lenderFilterConstraints` server-side | `convex/listings/portalQueries.ts`; `convex/listings/__tests__/queries.test.ts` | Numeric ranges, maturity date, and enum values are clamped before listing snapshots are loaded. |
| SATISFIED | projection | Reuse the shared portal pricing projection instead of rebuilding pricing math in ENG-301 | `convex/listings/portalQueries.ts`; `convex/listings/__tests__/queries.test.ts` | Uses `loadPortalPricingSelection`, `requirePortalPricingSelection`, `listMarketplaceListingsSnapshot`, and `getListingWithAvailabilitySnapshot`. |
| SATISFIED | frontend routing | Thin route consumers must read root `portalContext` and must not reparse the host in leaf routes | `src/routes/index.tsx`; `src/routes/lender.listings.tsx`; `src/components/lender/listings/LenderListingDetailPage.tsx` | Home, lender list, and detail all consume `RootRoute.useRouteContext()` and pass `portalId` into explicit query options. |
| SATISFIED | root boundaries | Keep blocked-host behavior and portal-state failures rooted at the shared boundary | `src/routes/__root.tsx`; `src/components/portal/portal-state-boundary.tsx`; `src/lib/portal/host-resolution.ts` | Non-root paths redirect away from blocked portal hosts, while reserved/unknown/unavailable states fail closed at the root surface. |
| SATISFIED | cache isolation + UI | Preserve portal-scoped query caching and use production listing UI rather than demo placeholders/mock routes | `src/router.tsx`; `src/test/routes/portal-query-cache-scope.test.ts`; `src/components/listings/MarketplaceListingsPage.tsx`; `src/components/listings/portal-query-options.ts` | Query hashing remains portal-scoped, and `MarketplaceListingsPage` now supports lender detail routing without importing demo-only modules. |
| SATISFIED | automated proof | Cover teaser/list/detail/query-contract behavior with targeted tests | `convex/listings/__tests__/queries.test.ts`; `src/test/routes/portal-home-route.test.tsx`; `src/test/routes/lender-listings-route.test.tsx`; `src/test/lender/listing-detail-page.test.tsx`; `src/test/listings/marketplace-listings-page.test.tsx` | Prior local validation for this worktree recorded passing `bunx convex codegen`, `bun check`, `bun typecheck`, and a targeted test bundle; those commands were not rerun during this audit. |
| UNVERIFIED | manual checkpoint | Anonymous teaser render and projected values on a real active portal host | No browser artifact in this checkout | The issue explicitly requires a human checkpoint on a live portal host; automated unit/integration tests do not replace that. |
| UNVERIFIED | manual checkpoint | Same-portal lender access, host-switch cache isolation, and disabled-pricing failure in a live browser session | No focused ENG-301 Playwright flow; no `bun run test:e2e` evidence in this audit | Code strongly suggests the contract is met, but there is not enough live end-to-end evidence to upgrade this to `ready`. |

## Open Questions
- Run a real browser smoke pass on an active broker portal host such as `*.localhost` or the canonical app host path before calling ENG-301 fully closed.
- Confirm the signed-in lender belongs to the same portal/broker relationship when validating `/lender/listings` and `/lender/listings/$listingId`.
- If a `ready` verdict is required, the next highest-signal step is either a manual portal-host smoke run or a focused Playwright flow that covers teaser, lender list/detail, host switch, and missing-pricing failure states.
