# Execution Checklist: ENG-325 - Broker onboarding: converge Account Claim onto broker resolve-or-provision

## Requirements From Linear
- [x] Reuse the canonical broker resolve-or-provision and activation logic from ENG-320 instead of creating a separate claim-only code path.
- [x] Match a claim to an existing broker by the strongest verified identifiers available and fail closed if the match is ambiguous.
- [x] Preserve the same portal assignment and `users.homePortalId` rules used by self-serve onboarding.
- [x] Patch missing broker profile fields onto the canonical record when a safe claim match exists instead of creating a duplicate record.
- [x] If no safe claim match exists, route the actor into the appropriate self-serve onboarding or manual-review path instead of silently provisioning a new broker.
- [x] Keep the convergence contract narrow enough that later claim-surface UI can consume it without reopening identity rules.
- [x] If no production claim UI exists yet, still deliver the backend helper plus a thin harness or internal contract that proves the convergence path can be exercised.

## Definition Of Done From Linear
- [x] A claim-convergence contract exists that reuses canonical broker activation rules.
- [x] Safe matches reuse existing broker and portal records.
- [x] Ambiguous matches fail closed instead of creating duplicates.
- [x] Shared portal-assignment logic remains the source of truth.
- [x] Later broker-claim work can build on this contract without reopening identity rules.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added for broker claim convergence helper and internal harness.
- [x] Route-level e2e tests are not expected because no production broker-claim UI exists yet; recorded as out of scope in `audit.md`.
- [x] Storybook stories are not expected because this slice is backend/helper-only; recorded as out of scope in `audit.md`.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed with pre-existing complexity warnings outside this scope.
- [x] `bun typecheck` passed.
- [x] Targeted tests passed.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
