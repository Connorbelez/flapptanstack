# Status: chunk-02-root-resolution

- Result: complete
- Last updated: 2026-04-20T16:42:55Z

## Completed tasks
- T-020: Shared trusted request-host extraction and host-resolution helpers landed under `src/lib/portal/`.
- T-021: Portal cache-key helper and fail-closed root boundary landed under `src/lib/portal/` and `src/components/portal/`.
- T-022: Root route context now resolves portal state beside auth, blocks non-root navigation for bad hosts, and the home route consumes the resolved context.

## Validation
- `bun run test -- src/test/routes/portal-context.test.tsx`: passed
- `bun run test:e2e`: not-applicable

## Notes
- This chunk depends on the persisted portal registry from chunk 1 and must preserve the existing WorkOS SSR auth flow.
- `src/router.tsx` did not require a logic change because the stable portal cache key is exposed on root route context rather than by mutating the router-wide hash function.
