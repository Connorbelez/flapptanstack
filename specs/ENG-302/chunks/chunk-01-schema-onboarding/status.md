# Status: chunk-01-schema-onboarding

- Result: complete
- Last updated: 2026-04-20 21:53:08 EDT

## Completed tasks
- T-010: Add `portalId` fields and supporting indexes to `borrowers` and `onboardingRequests` in `convex/schema.ts`
- T-020: Persist `onboardingRequests.portalId` in `convex/onboarding/mutations.ts` from trusted portal context and update onboarding tests/helpers

## Validation
- `bunx convex codegen`: pass
- `bun run test -- src/test/convex/onboarding/onboarding.test.ts src/test/convex/onboarding/onboarding-queries.test.ts src/test/auth/integration/onboarding-auth.test.ts`: pass

## Notes
- `requestRole` currently has no portal context input. This chunk decides the mutation contract that downstream portal-aware callers and tests will use.
- Work started on 2026-04-20 after `ready-to-edit` validation passed.
- The mutation now accepts optional trusted `portalId`, re-resolves it server-side, and persists it on the onboarding request plus audit payloads.
