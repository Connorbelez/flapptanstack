# Chunk Context: chunk-01-section-components

## Goal
- Validate the execution artifacts for editing and build the reusable suggested-opportunities card and section components that consume the server DTOs directly.

## Relevant plan excerpts
- "Ship the bottom-of-page Suggested opportunities section inside `/lender/portfolio` as a thin consumer over ordered server DTOs."
- "This slice reuses the existing lender listing and detail runtime for drill-down and keeps opportunities subordinate to positions, payments, and actions required."
- "ENG-308 publishes ordered suggested-opportunity DTOs; this issue does not rank or score listings in React."
- "Drill-down reuses the existing lender listing detail route rather than creating a parallel marketplace surface."

## Implementation notes
- The command-center contract already provides `suggestedOpportunities.availabilityState: "ready" | "unavailable"`, `suggestedOpportunities.unavailableReason?: string`, `suggestedOpportunities.rows`, `suggestedOpportunities.excludedOwnedMortgageCount`, and parent `snapshot.generatedAt`; the component layer should render those values rather than deriving new availability, scoring, or filter logic.
- The section should explicitly support loading, empty, unavailable, and stale-data presentation even though the route currently uses a suspense query for the page as a whole.
- Stale-data presentation should be derived from `snapshot.generatedAt`, because the current contract does not expose a dedicated stale flag for suggestions.

## Existing code touchpoints
- `src/components/lender/portfolio/LenderPortfolioPage.tsx`: current bottom-of-page slot placeholder owned by ENG-311.
- `src/components/lender/portfolio/fixtures.ts`: current suggestion DTO fixture plus `emptyStates.hasSuggestions`.
- `convex/portfolio/contracts.ts`: `portfolioSuggestedOpportunityValidator` and `portfolioSuggestedOpportunitiesSectionValidator`.
- `src/routes/listings/$listingId.tsx`: existing lender listing-detail destination for drill-down.
- GitNexus impact: `LenderPortfolioPage` is `LOW` risk with zero direct upstream callers/processes affected.
- GitNexus impact: `portfolioCommandCenterFixture` is `LOW` risk with zero direct upstream callers/processes affected.

## Validation
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-314 --repo-root "/Users/connor/.codex/worktrees/10f8/fairlendapp" --stage ready-to-edit`
- `bun run test -- src/test/lender/portfolio-suggested-opportunities.test.tsx`
