# Status: chunk-02-shell-ledgers

- Result: complete
- Last updated: 2026-04-22T19:42:20Z

## Completed tasks
- T-020
- T-021
- T-022
- T-023

## Validation
- `bun typecheck`: passed
- `bun run test -- src/test/routes/lender-portfolio-route.test.tsx`: passed

## Notes
- The shell keeps downstream cockpit/export/suggestions/rail leaf rendering out of scope while reserving stable slot hosts and the approved section order.
- Both ledgers keep positions first and payment activity second, with table-header filter and sort controls owned at the route/page layer.
