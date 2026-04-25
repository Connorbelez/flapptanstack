# Chunk Context: chunk-03-mic-config-tests

## Goal
- Provide a fail-closed MIC portal config resolver and prove the MIC lender mapping is explicit.

## Relevant plan excerpts
- Downstream MIC portfolio queries must not infer holdings from WorkOS org ownership or portal membership.
- A portal row with `portalType=mic` but no `micLenderAuthId` is treated as misconfigured for protected MIC queries.
- Suspended, archived, draft, or unpublished MIC portals are unavailable to protected consumers.

## Implementation notes
- Resolver should accept `portalId` and return an available MIC config with `portalId`, `orgId`, and `micLenderAuthId`, or a typed unavailable/misconfigured result.
- Avoid implementing MIC portfolio aggregation queries; this slice only produces the contract downstream query code will consume.
- Tests should cover missing mapping, wrong portal type, inactive/unpublished portal, and successful active MIC portal config.

## Existing code touchpoints
- `convex/portals/queries.ts`: existing portal query patterns.
- Optional new `convex/portals/micConfig.ts`: fail-closed config helper/query if direct placement is clean.
- `convex/portals/__tests__/registry.test.ts` and/or a new focused MIC config test file.
- `src/test/routes/route-host-policy.test.ts` and auth route tests for route-level contract.

## Validation
- Convex tests for MIC config availability and fail-closed behavior.
- Existing broker/FairLend portal registry tests continue to pass.
