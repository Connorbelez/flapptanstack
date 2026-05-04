# Chunk Context: chunk-02-playwright-helper-and-happy-path

## Goal
- Add a reusable Velocity Playwright helper and happy-path operator journey from board to activation.

## Relevant plan excerpts
- "Add the Velocity-specific Playwright helper/bootstrap layer that wraps the ENG-337 scenario API."
- "Cover successful package progression through board, workspace, final review, and activation."

## Implementation notes
- Mirror `e2e/helpers/origination.ts` for auth token, Convex client setup, PDF upload, and cleanup patterns.
- Use `POST /api/dev/velocity/scenarios` and package query surfaces from the shared mock/backend harness.
- Avoid browser-only state setup for readiness or activation; drive state through Convex mutations/actions and mock scenario endpoints.

## Existing code touchpoints
- `e2e/helpers/origination.ts`
- `e2e/origination/commit-and-inspect.spec.ts`
- `convex/velocity/mock.ts`
- `convex/http.ts`
- `src/components/admin/velocity/*`
- GitNexus impact analysis required before modifying existing helper or exported Velocity symbols.

## Validation
- Targeted Playwright spec for `e2e/velocity/operator-workflow.spec.ts`.
