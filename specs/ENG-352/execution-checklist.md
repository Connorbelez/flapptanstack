# Execution Checklist: ENG-352 - MIC portal: establish portal, RBAC, and MIC lender mapping contract

## Requirements From Linear
- [x] Add MIC as a first-class portal type without breaking existing `fairlend` and `broker` portal rows.
- [x] Ensure `mic.<domain>` and `mic.localhost:3000` resolve through existing host-aware portal resolution instead of a special-case route branch.
- [x] Store the dedicated MIC WorkOS organization id on the portal record through `orgId`.
- [x] Store or resolve the canonical MIC mortgage-ledger lender auth id explicitly; downstream MIC portfolio queries must not infer holdings from WorkOS org ownership or portal membership.
- [x] Add `mic:access` to the canonical permission catalog and WorkOS seeding script.
- [x] Add `micinvestor` to the role catalog with `mic:access` and no unrelated lender, broker, borrower, or admin permissions.
- [x] Add a route authorization key for MIC portal access that requires `mic:access` while preserving `admin:access` as the super-permission through the existing permission grant helpers.
- [x] Add tests proving existing broker/lender/borrower portal host resolution still passes after the MIC portal type is introduced.
- [x] Add tests proving a missing MIC lender mapping makes MIC config unavailable/fail-closed rather than falling back to org ownership.
- [x] Keep all exported Convex functions on fluent builders with explicit `.public()` or `.internal()` visibility.

## Definition Of Done From Linear
- [x] MIC portal rows are first-class portal registry records.
- [x] `mic:access` and `micinvestor` are represented in canonical code, tests, and WorkOS seeding script.
- [x] A consumer can resolve `mic.<domain>` / `mic.localhost:3000` to an active MIC portal.
- [x] A consumer can resolve exactly one canonical MIC lender auth id from the MIC portal contract.
- [x] Missing or invalid MIC mapping fails closed.
- [x] Existing broker, borrower, lender, and FairLend portal tests keep passing.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for portal validators/contracts, MIC config resolution, permission catalog, and route authorization.
- [x] E2E tests are explicitly not required for this foundational contract slice because the MIC route/UI are downstream issues.
- [x] Storybook stories are explicitly not required because this slice does not introduce reusable UI components or screens.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted tests for auth permissions, portal registry/middleware, and route host/auth behavior passed.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
