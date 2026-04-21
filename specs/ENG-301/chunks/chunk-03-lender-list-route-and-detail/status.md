# Status: chunk-03-lender-list-route-and-detail

- Result: complete
- Last updated: 2026-04-20 22:21 EDT

## Completed tasks
- T-020, T-021, T-022, T-023

## Validation
- Portal lender list route test: passed (`src/test/routes/lender-listings-route.test.tsx`)
- Portal lender detail component test: passed (`src/test/lender/listing-detail-page.test.tsx`)
- Portal query cache scope listing-consumer coverage: passed (`src/test/routes/portal-query-cache-scope.test.ts`)

## Notes
- Detail reads must move off `convex/react` `useQuery` if the host-scoped TanStack Query cache is going to protect real listing consumers.
