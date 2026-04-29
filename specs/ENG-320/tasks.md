# Tasks: ENG-320 - Broker onboarding: hand off approved application into onboardingRequest and activate canonical broker/portal

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning And Contracts
- [x] T-001: Validate ENG-316/ENG-319 contracts exist in this worktree and scaffold execution artifacts.
- [x] T-010: Extend schema/contracts for broker activation provenance and referral attribution on canonical records.
- [x] T-011: Run GitNexus impact analysis for existing symbols planned for modification and record blast radius in chunk context.

## Phase 2: Activation Helpers
- [x] T-020: Add canonical broker resolve-or-provision helper with strongest-identifier-first lookup, `_id` stability, and fail-closed conflict handling.
- [x] T-021: Add reusable broker portal upsert helper using shared slug normalization, reserved slug rejection, host derivation, pricing, and portal registry invariants.
- [x] T-022: Add broker activation coordinator that resolves/provisions broker, upserts portal, syncs `users.homePortalId`, persists provenance/referral data, and returns a stable activation outcome.

## Phase 3: Handoff Wiring
- [x] T-030: Add an internal create-or-link helper for approved applications to produce one downstream broker `onboardingRequest` with provenance.
- [x] T-031: Wire approval paths to create/link and approve the downstream request through the existing `onboardingRequest` GT path.
- [x] T-032: Wire the downstream role-assignment effect to call the broker activation seam after `ASSIGN_ROLE` completes.
- [x] T-033: Keep existing manual link/role-assigned/mark-activated helpers idempotent and compatible with the new activation outcome.

## Phase 4: Tests
- [x] T-040: Add or update tests for approved-application handoff, request linkage, and downstream effect reuse.
- [x] T-041: Add or update tests for broker reuse, ambiguous identity, cross-org conflict, and idempotent retries.
- [x] T-042: Add or update tests for portal slug conflict, reserved slug rejection, portal reuse, home-portal sync, referral persistence, and activation semantics.

## Phase 5: Validation And Audit
- [x] T-900: Run focused backend tests for ENG-320 scope.
- [x] T-901: Run `bunx convex codegen`.
- [x] T-902: Run `bun check`.
- [x] T-903: Run `bun typecheck`.
- [x] T-910: Run `$linear-pr-spec-audit` against ENG-320 and the current branch diff.
- [x] T-920: Resolve audit findings or record blockers.
