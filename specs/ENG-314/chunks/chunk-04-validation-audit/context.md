# Chunk Context: chunk-04-validation-audit

## Goal
- Run the repository quality gates and targeted automated tests after the ENG-314 leaf UI changes are in place.

## Relevant plan excerpts
- "Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`."
- "`bun run test -- convex/portfolio/__tests__/suggestions.test.ts src/test/lender/portfolio-suggested-opportunities.test.tsx`."
- "Focused tests and repo validation commands pass."

## Implementation notes
- The repo currently keeps suggestion-contract coverage in `convex/portfolio/__tests__/queries.test.ts`, so the targeted backend suite should use that existing file unless implementation introduces a dedicated `suggestions.test.ts`.
- `bun check` must run before attempting manual lint/format cleanup because the repo instructions treat it as the canonical fixer/checker entry point.
- `bunx convex codegen` is still mandatory even if the change is frontend-heavy because the repo instructions require it before closeout.

## Existing code touchpoints
- Repo commands from `AGENTS.md`
- `convex/portfolio/__tests__/queries.test.ts`
- `src/test/lender/portfolio-suggested-opportunities.test.tsx`
- `src/test/routes/lender-portfolio-route.test.tsx`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `bun run test -- convex/portfolio/__tests__/queries.test.ts src/test/lender/portfolio-suggested-opportunities.test.tsx src/test/routes/lender-portfolio-route.test.tsx`
