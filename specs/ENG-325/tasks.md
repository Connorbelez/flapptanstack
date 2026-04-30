# Tasks: ENG-325 - Broker onboarding: converge Account Claim onto broker resolve-or-provision

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Read Linear issue, comments, relations, and attached Notion implementation plan.
- [x] T-002: Scaffold execution artifacts and define implementation chunks.
- [x] T-003: Run GitNexus indexing and impact analysis for existing broker activation seams.

## Phase 2: Claim Contract
- [x] T-010: Add `convex/brokers/claimConvergence.ts` with typed claim inputs, deterministic outcomes, safe-match detection, fallback routing, and reuse of broker activation helpers.
- [x] T-011: Narrowly adjust `convex/brokers/resolveOrProvision.ts` so broker onboarding application provenance can be optional for future claim consumers while preserving ENG-320 behavior.
- [x] T-012: Ensure safe claim matches patch the canonical broker and reuse broker portal/home-portal assignment without creating duplicate broker rows.

## Phase 3: Harness And Tests
- [x] T-020: Add an internal claim-convergence harness callable for backend/test use before production claim UI exists.
- [x] T-021: Add targeted Convex tests for safe-match reuse, ambiguous-match failure, no-match fallback, duplicate prevention, and portal assignment reuse.
- [x] T-022: Confirm route e2e and Storybook coverage are not applicable because no user-visible claim UI is introduced.

## Phase 4: Validation
- [x] T-900: Run `bun run test -- src/test/convex/brokers/claimConvergence.test.ts`.
- [x] T-901: Run `bunx convex codegen`.
- [x] T-902: Run `bun check`.
- [x] T-903: Run `bun typecheck`.
- [x] T-910: Run `$linear-pr-spec-audit` and persist verdict in `specs/ENG-325/audit.md`.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution artifact validation.
