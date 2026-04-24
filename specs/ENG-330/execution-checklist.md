# Execution Checklist: ENG-330 - Velocity package: establish schema, contract, and audit primitives

## Requirements From Linear
- [x] Add the dedicated Velocity package tables and indexes in `convex/schema.ts` for workspaces, snapshots, webhook events, sync attempts, activation attempts, exceptions, and package document links.
- [x] Define shared Velocity enums, raw-envelope validators, normalized core DTOs, FairLend enrichment DTOs, readiness/exception types, and `VelocityActivationHandoffV1` in reusable modules.
- [x] Introduce Velocity-specific provenance/idempotency constants, including workflow source type/key builders and webhook/sync/activation key helpers.
- [x] Make package-owned activation remediation explicit for at least `loanType` and `lienPosition` and keep the same surface extensible for other non-deterministic canonical inputs.
- [x] Codify v1 status semantics so only `Funded (6)` enables activation, `Complete (7)` routes to remediation if FairLend has not activated, and Parked/Cancelled/Declined remain non-actionable without inventing new persisted states.
- [x] Define package audit helper contracts that preserve webhook agent identity and connector credential scope and write through the existing append-only audit pipeline.
- [x] Keep all package document references keyed to existing `documentAssets` rows instead of inventing a parallel file-store contract.
- [x] Publish only fluent-convex endpoints and shared builder modules; do not ship raw exported helper functions as pseudo-endpoints.

## Definition Of Done From Linear
- [x] All Velocity aggregate tables, indexes, and validators exist and `bunx convex codegen` can type-check them.
- [x] Downstream issues can import stable DTOs, workflow source constants, and exception/readiness enums from a single Velocity namespace.
- [x] Package-owned activation remediation fields for `loanType` and `lienPosition` are explicitly modeled.
- [x] Velocity-specific audit/provenance helpers are defined against the shared audit journal instead of ad hoc logging.
- [x] No downstream slice needs to guess table names, status strings, enum labels, or workflow source keys.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for Velocity constants, status semantics, idempotency builders, exported namespace stability, and validator/schema assumptions.
- [x] E2E tests are not added because ENG-330 is backend contract/schema foundation only and does not expose a user/operator workflow.
- [x] Storybook stories are not added because ENG-330 creates no reusable UI or composed screen states.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed: `bun check`, `bun typecheck`, `bunx convex codegen`, and targeted Velocity tests.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.

## Broader Repo Validation Note
- `bun run test` currently fails in unrelated existing suites outside ENG-330. The focused Velocity test suite passes and no failure references the new Velocity modules.
