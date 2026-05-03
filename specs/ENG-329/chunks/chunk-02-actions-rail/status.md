# Status: chunk-02-actions-rail

- Result: complete
- Last updated: 2026-04-22T23:16:43Z

## Completed tasks
- T-010: Added `action-item-host.tsx` to render generic renewal, payment, and deal-action rows with contract-backed status, due date, context, and CTA states.
- T-011: Added `actions-rail.tsx` so the rail keeps `Actions Required` visible in all-clear and active-item states without taking ownership of business rules.

## Validation
- `bun run test -- src/test/lender/portfolio-rail.test.tsx src/test/routes/lender-portfolio-route.test.tsx`: passed

## Notes
- The action host remains generic: payment and mortgage actions can deep-link into detail sheets, while deal-only follow-ups remain handoff-only as required.
