# Status: chunk-03-refresh-surface

- Result: complete
- Last updated: 2026-04-22 17:52:41 EDT

## Completed tasks
- T-070: The shared internal refresh orchestration seam in `fsraImport.ts` now backs both cron and manual invocation paths.
- T-080: The admin refresh action and daily FSRA cron are wired to that seam.

## Validation
- `bun run test -- src/test/convex/onboarding/verification-contracts.test.ts src/test/convex/onboarding/fsra-import.test.ts src/test/convex/onboarding/regulator-provider.test.ts`: passed
- `bunx convex codegen`: pending in final validation sweep

## Notes
- This chunk should stay operational only; no UI route or page work belongs here.
- `convex/test/moduleMaps.ts` needed onboarding verification loader entries so the new action/provider tests could resolve internal Convex modules.
