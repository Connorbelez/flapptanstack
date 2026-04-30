# Chunk Context: chunk-03-tests-validation-audit

## Goal
- Add focused tests, run repo validation commands, run the required spec audit, fix findings, and close execution artifacts.

## Relevant plan excerpts
- "Add targeted route or component tests for resume behavior, host-aware preview behavior, submitted-status rendering, `changes_requested` rendering, broker-note append behavior, and any distinction between `approved` and `activated` screens."
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`.

## Implementation notes
- Prefer jsdom component tests with mocked `convex/react`, `@workos/authkit`, and route context.
- Add no e2e tests unless component tests cannot cover the route states; document rationale either way.
- Add no Storybook stories unless components become reusable outside the route; document rationale either way.
- Run `$linear-pr-spec-audit` and persist its verdict in `audit.md`.

## Existing code touchpoints
- Existing route tests live under `src/test/routes/`.
- Existing tests mock route `Route.useSearch`, `RootRoute.useRouteContext`, and query hooks directly.

## Validation
- `bun run test -- src/test/routes/onboard.route.test.tsx src/test/routes/onboard.status.test.tsx src/test/routes/onboard.notes.test.tsx`
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- final artifact validator
