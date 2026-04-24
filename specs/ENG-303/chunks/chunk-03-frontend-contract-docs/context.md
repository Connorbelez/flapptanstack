# Chunk Context: chunk-03-frontend-contract-docs

## Goal
- Provide a stable frontend type surface and nearby contract documentation for ENG-305.

## Relevant plan excerpts
- "Add a thin frontend type for the landing contract so `ENG-305` can consume it without re-deriving field names."
- "Document fallback behavior for absent optional copy and teaser data."

## Implementation notes
- Add `src/components/portal/landing/landing-types.ts`.
- Prefer deriving the type from `api.portals.queries.getPublicPortalLandingPage` return shape where possible so frontend and backend drift less.
- If a type derivation is not ergonomic with generated Convex types, define a matching exported TypeScript interface without `any`.

## Existing code touchpoints
- `src/components/listings/query-options.ts` and `portal-query-options.ts` show local Convex query option patterns.
- `src/components/listings/index.ts` shows barrel export style.

## Validation
- `bun typecheck`
