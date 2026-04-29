# Chunk Context: chunk-04-tests-validation

## Goal
- Add focused coverage and run required validation gates plus final spec audit.

## Relevant plan excerpts
- "Add targeted tests around application-to-request handoff, reuse of the downstream provisioning effect path, broker identity reuse, slug conflict handling, home-portal sync, idempotent retries, and post-auth redirect behavior."
- Validation commands: `bunx convex codegen`, `bun check`, `bun typecheck`, and focused tests for activation scope.

## Implementation notes
- This is backend-only unless code inspection shows `src/lib/portal/auth-completion.ts` needs a contract change. If `homePortalId` sync stays canonical, no route or Storybook work is expected.
- E2E coverage is not expected unless frontend/auth-completion code changes.

## Existing code touchpoints
- `src/test/convex/onboarding/brokerApplication.activation.test.ts`
- `src/test/convex/brokers/resolveOrProvision.test.ts`
- `src/test/convex/portals/brokerPortalActivation.test.ts`
- Existing `src/test/convex/onboarding/brokerApplication.handoff.test.ts`

## Validation
- `bun run test -- src/test/convex/onboarding/brokerApplication.activation.test.ts src/test/convex/brokers/resolveOrProvision.test.ts src/test/convex/portals/brokerPortalActivation.test.ts`
- `bun run test -- src/test/convex/onboarding/brokerApplication.handoff.test.ts`
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `$linear-pr-spec-audit`
