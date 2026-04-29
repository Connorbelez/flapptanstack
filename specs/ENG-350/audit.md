# Spec Audit: ENG-350 - Listing detail: enable hosted checkout launch UI

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against repository base
- Last run: 2026-04-25T16:18:04Z
- Verdict: ready

## Findings
- No material spec-compliance findings.

## Unresolved items
- none

## Next action
- ready for human review.

## Coverage Summary
- SATISFIED: 15
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | backend contract | Detail DTO exposes checkout eligibility, server lock-fee copy, fraction bounds, and platform lawyer option | `convex/listings/marketplace.ts` | Eligibility requires production-backed mortgage listing plus available fractions. |
| SATISFIED | frontend contract | Adapter and shared types map server checkout DTO without client fee authority | `src/components/listings/listing-detail-types.ts`, `src/components/listings/marketplace-detail-adapter.ts` | Client submits fractions and lawyer snapshot only. |
| SATISFIED | UI capability | Eligible production detail renders hosted checkout launcher | `src/components/listings/MarketplaceListingDetailPage.tsx`, `src/components/listings/ListingDetailPage.tsx` | Mode is interactive only when `checkout.isEligible` is true. |
| SATISFIED | negative contract | No embedded Stripe Elements, card fields, or PaymentIntent-first flow | `src/components/listings/ListingDetailPage.tsx` | Launcher redirects to hosted URL returned by backend. |
| SATISFIED | UI validation | Fraction and lawyer controls gate checkout start | `src/components/listings/ListingDetailPage.tsx` | Tests cover guest-lawyer validation and duplicate-submit guard. |
| SATISFIED | integration | UI calls ENG-340 `startMarketplaceCheckout` action and uses route portal authority | `src/components/listings/MarketplaceListingDetailPage.tsx`, `src/test/listings/marketplace-listing-detail-page.test.tsx` | Test proves route `portalId` overrides UI input portal. |
| SATISFIED | return states | Success pending, abandoned, expired, provider failure, and generic error render from search state | `src/routes/listings/$listingId.tsx`, `src/components/listings/ListingDetailPage.tsx` | Success copy does not claim deal creation. |
| SATISFIED | auth wrapper | Authenticated suspense route wrapper remains unchanged | `src/routes/listings/route.tsx` | Detail route still renders under the existing authenticated layout. |
| SATISFIED | read-only states | Demo/read-only/ineligible listings cannot start checkout and render disabled reason | `src/components/listings/ListingDetailPage.tsx`, `src/test/listings/listing-detail-checkout.test.tsx` | Server disabled reasons pass through. |
| SATISFIED | tests | Relevant RTL tests cover launcher and route/action handoff | `src/test/listings/listing-detail-checkout.test.tsx`, `src/test/listings/marketplace-listing-detail-page.test.tsx`, `src/test/routes/listings-route.test.tsx` | E2E/Storybook not added; rationale recorded in checklist. |
| SATISFIED | validation | Required commands pass | execution log | `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests all pass. |

## Open Questions
- none
