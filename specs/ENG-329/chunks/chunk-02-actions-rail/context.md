# Chunk Context: chunk-02-actions-rail

## Goal
- Deliver the `Actions Required` surface as a first-class rail section with generic action rendering, contract-backed metadata, and action-level deep-link or prefill hooks.
- Preserve the all-clear state instead of dropping the section when there are no active actions.

## Relevant plan excerpts
- "Host renewal, payment, and deal-related action items without owning renewal-specific business rules."
- "Let rail items deep-link or prefill broker coordination with relevant context when possible."
- "Preserve all-clear, unavailable-chat, and missing-broker fallback states instead of removing the rail."
- "Actions Required remains above broker chat."

## Implementation notes
- `LenderPortfolioPage.tsx` currently renders a placeholder `Actions required host` block inside the sticky rail slot; ENG-329 should replace that placeholder without moving the slot or its responsive collapse behavior.
- The action-item UI should stay generic to the upstream DTO (`kind`, `priority`, `status`, `dueDate`, `prefillContext`) rather than branching into renewal-specific business rules.
- The backend contract already supports `renewal_prompt`, `payment_exception`, `deal_action`, and `broker_message`, so the leaf rendering should avoid hard-coding only one subtype.

## Existing code touchpoints
- `src/components/lender/portfolio/LenderPortfolioPage.tsx`
- `src/components/lender/portfolio/portfolio-formatters.ts`
- `src/components/lender/portfolio/fixtures.ts`

## Validation
- `bun run test -- src/test/lender/portfolio-rail.test.tsx`
