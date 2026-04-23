# Chunk Context: chunk-03-broker-chat-and-wiring

## Goal
- Deliver the day-one broker coordination panel directly below `Actions Required`, keeping the surface assigned-contact or single-thread oriented instead of inbox-shaped.
- Wire the selected rail context into the broker panel so users can carry mortgage, payment, or deal context into broker coordination without inventing broker state locally.

## Relevant plan excerpts
- "Keep broker chat day-one single-thread or assigned-contact oriented, not inbox-shaped."
- "Do not invent broker identity, availability, or chat state locally in React."
- "Broker chat unavailability should preserve the rail with fallback broker/contact context."
- "The issue owns the broker chat surface and its all-clear, unavailable, and missing-broker states."

## Implementation notes
- The current contract only exposes `fallback_contact_only` and `missing_broker` availability states, plus an optional `threadId`; the UI should communicate that this is a thin coordination surface and not a fully live chat product.
- The broker panel should reuse the `prefillContextPayloads` and action-selected context rather than generating new lender/broker message summaries in the UI.
- `LenderPortfolioPage.tsx` is the right place for lightweight local selection state because the route already owns the command-center snapshot and search-state orchestration.

## Existing code touchpoints
- `src/components/lender/portfolio/LenderPortfolioPage.tsx`
- `src/components/lender/portfolio/fixtures.ts`
- `convex/portfolio/contracts.ts`
- `convex/portfolio/helpers.ts`

## Validation
- `bun run test -- src/test/lender/portfolio-rail.test.tsx`
- `bun run test -- src/test/routes/lender-portfolio-route.test.tsx`
