# Summary: ENG-352 - MIC portal: establish portal, RBAC, and MIC lender mapping contract

- Source issue: https://linear.app/fairlend/issue/ENG-352/mic-portal-establish-portal-rbac-and-mic-lender-mapping-contract
- Primary plan: linear://ENG-352#embedded-implementation-plan
- Supporting docs:
  - https://www.notion.so/311fc1b4402480aa99c0feba9c1bfacc
  - https://www.notion.so/33ffc1b4402481f3b1f5d84c9cf98b0b
  - https://www.notion.so/326fc1b4402481829adfcc10b7674385

## Scope
- Add `mic` as a first-class portal type in Convex validators, schema-backed portal records, shared portal contracts, and tests without breaking `fairlend` or `broker`.
- Support a seeded/configured MIC portal record with `slug=mic`, `localHost=mic.localhost:3000`, `productionHost=mic.fairlend.ca`, `defaultPostAuthPath=/portal`, a dedicated WorkOS `orgId`, and explicit `micLenderAuthId`.
- Add `mic:access` permission metadata, WorkOS permission seeding support, and `micinvestor` role mapping with no unrelated permissions.
- Add a route authorization key for MIC portal access that requires `mic:access` while preserving `admin:access` super-permission behavior.
- Add a fail-closed MIC portal config resolver so downstream portfolio query work can require an explicit lender mapping instead of deriving holdings from WorkOS org or portal membership.
- Add/update targeted tests for portal host resolution, permission catalog parity, route authorization, and missing MIC lender mapping behavior.

## Constraints
- No public request form, admin triage UI, MIC portfolio aggregation query, public landing page presentation, cash treasury reporting, personalized cap table, or investor-specific holdings work in this slice.
- MIC host routing must use the existing portal registry and host-aware resolution path; do not add a one-off `mic.fairlend.ca` branch.
- MIC holdings must be keyed by explicit mortgage-ledger lender identity stored/resolved from portal config, not by `orgId`, portal membership, or WorkOS organization ownership.
- `admin` keeps exactly one WorkOS permission: `admin:access`; do not add `mic:access` to admin as a substitute.
- Exported Convex functions must use fluent builders and explicit `.public()` or `.internal()` visibility.
- Avoid touching `PortalBuilder` or shared auth-routing internals unless impact analysis says the blast radius is acceptable.

## Open questions
- No separate Notion implementation-plan page was found for ENG-352. The Linear issue body contains the managed implementation plan, requirements, DoD, GitNexus notes, and TDD plan; this artifact treats it as the primary handoff.
