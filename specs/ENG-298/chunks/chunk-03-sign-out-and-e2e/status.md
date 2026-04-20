# Status: chunk-03-sign-out-and-e2e

- Result: complete
- Last updated: 2026-04-20 17:13 EDT

## Completed tasks
- T-030: Added host-aware sign-out plumbing plus a shared route-context hook for all logout callers.
- T-031: Updated localhost-focused auth helpers and Playwright/Vite config to use `localhost` plus caller-selected `*.localhost` entry points.
- T-032: Recorded Storybook as not applicable because the new rejection state remains route-specific in this issue.

## Validation
- `bun run test -- convex/portals/__tests__/registry.test.ts src/test/routes/auth-routes.test.ts src/test/routes/portal-auth-callback.test.tsx`: pass
- `bun typecheck`: pass
- `bunx convex codegen`: pass

## Notes
- Keep local host coverage on `localhost` and `*.localhost`; do not preserve `127.0.0.1`.
- This chunk owns both host-aware WorkOS `returnTo` plumbing and the remaining localhost E2E helper/script cleanup.
- Live multi-host browser validation was deferred to chunk `chunk-04-validation-and-audit`.
