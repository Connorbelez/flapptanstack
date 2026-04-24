# Spec Audit: ENG-303 - Broker landing page: define the v1 production portal template contract

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff for ENG-303 in `/Users/connor/.codex/worktrees/48fb/fairlendapp`
- Last run: 2026-04-24T16:11:47-04:00
- Verdict: ready

## Findings
- none

## Unresolved items
- Full repository `bun run test` has unrelated existing failures outside the ENG-303 contract surface. ENG-303 targeted tests and required quality gates passed.

## Next action
- none

## Requirement Ledger

| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | capability | One public landing contract combines portal identity, broker identity, teaser listings, CTA copy, and financing-strip copy. | `convex/portals/queries.ts`, `convex/portals/validators.ts` | `getPublicPortalLandingPage` returns one read model. |
| SATISFIED | structural data | Reuse resolved `portalId` from root `portalContext`; do not re-resolve host in leaves. | `convex/portals/queries.ts` | Query accepts `portalId` and reads persisted portal row. |
| SATISFIED | broker data | Use live broker brokerage and license data where available. | `buildBrokerLicense`, landing tests | Broker fallback test asserts brokerage and license label. |
| SATISFIED | data model | Add minimal optional v1 IA copy only where runtime data is insufficient. | `convex/schema.ts`, `portalLandingPageContentValidator` | Stored under `portalLandingPages.v1LandingContent`; no arbitrary blocks/theme. |
| SATISFIED | contract shape | FairLend `app` and broker portals share the same shape. | `convex/portals/__tests__/landing.test.ts` | Test covers FairLend app portal using same query shape. |
| SATISFIED | IA fields | Contract includes nav, hero, trust strip, switchboard CTAs, nested pre-approval, featured listings, and financing strip. | `publicPortalLandingPageValidator` | Fields are required in returned contract with deterministic fallbacks. |
| SATISFIED | listings | Featured teasers use live listing runtime and portal pricing projection. | `buildFeaturedListings`, `listMarketplaceListingsSnapshot`, tests | Added `termMonths` projection for teaser term label. |
| SATISFIED | fallbacks | Missing optional content cannot break rendering. | fallback builder tests | Disabled teaser and missing copy paths return stable objects. |
| SATISFIED | public boundary | Public landing contract is available only for active public portal availability. | `getPublicPortalLandingPage`, landing tests | Draft, suspended, archived, unpublished, or pricing-misconfigured portals return `null`. |
| SATISFIED | portal configuration | Featured teaser count respects `portals.teaserListingLimit`. | `buildFeaturedListings`, landing tests | Zero limit returns no listing items. |
| SATISFIED | CTA safety | Stored landing CTA hrefs are constrained before public contract return. | `validatePortalLandingPageContentSafety`, landing tests | Allows relative paths and hash anchors; rejects unsafe protocol strings. |
| SATISFIED | negative contract | Pre-approval stays nested under borrower financing, not a third peer block. | `switchboard.borrower.nestedActions` | Covered by fallback and override tests. |
| SATISFIED | negative contract | No demo state, mock store, CMS/theme, arbitrary block, or self-serve authoring scope. | changed files and docs | Contract is validator/read-model only. |
| SATISFIED | documentation | Document structural runtime dependencies versus optional presentation copy. | `docs/architecture/broker-landing-page-contract.md` | Includes fallback policy and out-of-scope boundaries. |
| SATISFIED | tests | Backend contract shaping, fallback behavior, teaser projection, public availability, teaser limit, and href safety covered. | `convex/portals/__tests__/landing.test.ts` | Nine focused tests pass. |
