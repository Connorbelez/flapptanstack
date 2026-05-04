# Spec Audit: ENG-305 - Broker landing page: render the fixed-template production portal root

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against `HEAD`
- Last run: 2026-04-24T22:02:16Z
- Verdict: needs manual validation

## Findings
- none

## Unresolved items
- Manual live-data validation remains: local browser smoke on `app.localhost:3000` reached the production root without the generic shared header, but the active local portal returned `Portal landing page unavailable` because the landing contract could not be loaded from the current local deployment data. `meridian.localhost:3000` correctly stayed fail-closed as a misconfigured portal. Automated route/component tests cover the approved IA using the production landing contract.

## Next action
- Validate the page on a seeded active portal host whose `getPublicPortalLandingPage` contract returns data, or seed local portal data before a final visual sign-off.

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | frontend | Replace minimal `/` portal route with production landing renderer consuming ENG-303 contract | `src/routes/index.tsx` queries `api.portals.queries.getPublicPortalLandingPage`; `PortalLandingPage` composes the result | Non-portal fallback route remains unchanged |
| SATISFIED | IA | Render top nav, broker-first hero, trust strip, two-path switchboard, featured listings teaser, inline financing strip in order | `src/components/portal/landing/PortalLandingPage.tsx` renders sections in the required order | Covered by `portal-home-route.test.tsx` |
| SATISFIED | brand posture | Keep FairLend visible as operating/trust layer without overtaking broker branding | Navigation, hero, and side rail use broker brand first with powered-by/operating-layer language | Contract-driven broker label |
| SATISFIED | fail-closed | Preserve root fail-closed portal behavior | `src/routes/__root.tsx` still wraps outlet in `PortalStateBoundary`; browser smoke confirmed misconfigured `meridian.localhost:3000` stays blocked | Existing root boundary owns invalid hosts |
| SATISFIED | live data | Reuse live portal-aware teaser listing data, not demo state | Renderer consumes `featuredListings.items` from landing contract; no demo imports or Zustand/mock-data modules | ENG-303 query composes listing runtime |
| SATISFIED | teaser UI | Show only three visible teaser cards plus blurred continuation | `PortalLandingFeaturedListings` slices to max 3 and renders continuation only from `hasBlurredContinuation` | Contract visible-card count also respected |
| SATISFIED | teaser copy | Keep teaser product-like and neutral with no persona-targeting explanation | Teaser card shows image, position, property type, status, title, amount, rate, LTV, term | No curation/persona text |
| SATISFIED | CTA hierarchy | Keep pre-approval nested inside financing side | Borrower panel renders `nestedActions`, including pre-approval, under the borrower primary action | Covered by route test |
| SATISFIED | responsiveness | Make page responsive without collapsing hierarchy | Components use responsive grids and stable card dimensions | Automated DOM coverage only; final visual sign-off remains manual |
| SATISFIED | chrome | Bypass generic shared header on public portal root | `shouldRenderSharedHeader` suppresses header for `pathname === "/" && portalContext.kind === "portal"` | Covered by `root-shared-header-policy.test.ts` |
| SATISFIED | contract-driven actions | Keep lender/borrower destinations driven by landing contract | All action links use contract `href`/`label` values | No hardcoded demo destinations in renderer |
| SATISFIED | negative scope | Avoid demo route imports, Zustand stores, and mock data modules | Changed production files import only landing contract/types, UI primitives, lucide, and route/query dependencies | Tests use local fixtures only |
| SATISFIED | tests | Add/update route/component coverage | `portal-home-route.test.tsx` and `root-shared-header-policy.test.ts` pass | Vitest emits close-timeout warning after success |
| UNVERIFIED | browser | Valid seeded portal host renders approved IA from live data | Local smoke could not find a seeded active portal returning landing data | Needs seeded portal or deployment data validation |
