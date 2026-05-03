# Summary: ENG-314 - Lender portfolio: ship bottom-of-page suggested opportunities

- Source issue: https://linear.app/fairlend/issue/ENG-314/lender-portfolio-ship-bottom-of-page-suggested-opportunities
- Primary plan: https://www.notion.so/349fc1b440248177ad09cfd41a226b84
- Supporting docs:
- https://www.notion.so/318fc1b4402481cda6dfc6381b99d9fb
- https://www.notion.so/349fc1b44024815a8e01d57ccc4a53f8
- https://www.notion.so/349fc1b44024815d9f24e9f7625bb88e

## Scope
- Replace the ENG-311 placeholder content in the bottom suggested-opportunities slot with the real leaf consumer for ordered server DTOs.
- Add a reusable suggested-opportunities section and suggestion card surface under `src/components/lender/portfolio/` that renders fit rationale, explanation tags, listing metadata, and drill-down CTAs.
- Preserve the approved command-center composition order by keeping suggestions below the export strip and outside the route-shell/query-seam ownership boundary.
- Add focused consumer tests and Storybook coverage for populated, empty, unavailable, loading, and stale-data presentation states.
- Close out the issue with repo validation, a spec-compliance audit, and a GitNexus changed-scope review.

## Constraints
- Consume `snapshot.suggestedOpportunities.rows` as already ordered by `ENG-308`; do not rank, score, or re-implement broker filters in React.
- Respect `excludedOwnedMortgageCount`, server-owned broker constraints, and listing visibility exactly as delivered by the command-center contract.
- Reuse the existing listing drill-down runtime under `src/routes/listings/$listingId.tsx`; do not create a parallel marketplace or portfolio-specific detail route.
- Keep the section anchored at the bottom of `/lender/portfolio`, below the lower export strip and below the positions/payment work surfaces.
- Do not take broad ownership of `src/routes/lender.portfolio.tsx`, shared portfolio query-option builders, or the baseline route test surface that belongs to `ENG-311`; targeted loading/refetch behavior and route coverage changes are permitted only when required to integrate the suggested-opportunities consumer.
- Treat `snapshot.generatedAt` as the available freshness signal for stale-data presentation; do not introduce a new backend contract for this UI-only slice unless implementation proves it is required.
- Raise markdown findings only when they reveal actual architectural drift or implementation inconsistencies relative to the codebase.

## Open questions
- none
