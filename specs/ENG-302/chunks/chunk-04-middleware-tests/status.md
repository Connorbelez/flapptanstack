# Status: chunk-04-middleware-tests

- Result: complete
- Last updated: 2026-04-20 22:22:14 EDT

## Completed tasks
- T-070 completed by switching `resolvePortalBorrower` to explicit `borrowers.portalId` matching.
- T-080 completed with targeted onboarding/origination/registry/middleware fixture updates, including same-org wrong-portal denial coverage.

## Validation
- `bun run test -- convex/portals/__tests__/middleware.test.ts`: passed

## Notes
- Preserve the ENG-299 structural boundary: portal membership first, resource access second.
- The borrower denial coverage now proves the ENG-302 contract directly: a borrower whose `orgId` still matches the current portal is rejected when explicit `portalId` points elsewhere.
