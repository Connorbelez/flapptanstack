# Status: chunk-02-playwright-helper-and-happy-path

- Result: blocked
- Last updated: 2026-04-24T19:22:00Z

## Completed tasks
- T-210: Added `e2e/helpers/velocity.ts` for ENG-337 HTTP scenario creation, Convex auth/client access, workspace lookup, FairLend enrichment, PAD document linking, final review, activation, mock deal patching, webhook delivery, and board navigation.
- T-220: Added `e2e/velocity/operator-workflow.spec.ts` for board -> workspace -> final review -> activation.
- T-230: The spec pulls loan code, link application ID, workspace state, review hashes, and activation state from backend scenario/query payloads.

## Validation
- `bun run typecheck`: passed.
- `bunx playwright test e2e/velocity/operator-workflow.spec.ts --project=velocity --no-deps`: blocked because the current dev deployment does not expose `/api/dev/velocity/scenarios`.
- `bunx convex dev --once`: blocked by existing dev data/schema mismatch: `portals.portalType` contains `"mic"` but the schema allows only `"fairlend" | "broker"`.

## Notes
- Browser tests depend on a dev deployment that includes the ENG-337 mock Velocity endpoint contracts. The source routes exist in `convex/http.ts`, but the current deployment still returns `404 No matching routes found`.
