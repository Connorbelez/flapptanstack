# Tasks: ENG-362 - Legal representation: implement guest invitations and WorkOS identity resolution

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear, Notion, AGENTS, RBAC, WorkOS, and GitNexus context.
- [x] T-002: Scaffold and populate execution artifacts.
- [x] T-003: Validate execution artifacts for ready-to-edit.

## Phase 2: Schema And Token Utilities
- [x] T-010: Confirm existing lawyer invitation/profile/verification schema supports ENG-362 lifecycle fields.
- [x] T-011: Add token generation, hashing, expiry, and constant-time verification helpers.
- [x] T-012: Add invitation status/remediation helper types where schema validators need extension.

## Phase 3: Backend Lifecycle
- [x] T-020: Implement invitation create/resend/revoke/read lifecycle functions using fluent-convex visibility.
- [x] T-021: Implement WorkOS-backed guest lawyer identity resolution boundary with deterministic test doubles.
- [x] T-022: Implement guest profile resolve-or-provision precedence by auth ID, normalized email, and bar/jurisdiction.
- [x] T-023: Implement immutable verification evidence recording and verified invitation finalization.
- [x] T-024: Implement idempotent provisional email dealAccess migration to resolved WorkOS auth ID.
- [x] T-025: Preserve resource-check compatibility during pending migration and revoke fallback after migration.

## Phase 4: Route And Auth Resume
- [x] T-030: Add verification entry route for `/lawyer/verify/$token`.
- [x] T-031: Require WorkOS sign-in/sign-up and resume invite acceptance after AuthKit callback.
- [x] T-032: Render fail-closed route states for expired, revoked, used, tampered, mismatch, and retryable failures.

## Phase 5: Tests
- [x] T-040: Add unit tests for token hash/expiry/single-use helpers.
- [x] T-041: Add backend tests for invitation create/resend/accept/verify lifecycle.
- [x] T-042: Add backend tests for duplicate profile prevention and access migration idempotency.
- [x] T-043: Add backend tests for restricted or mismatched lawyer failure without access grant.
- [x] T-044: Add route/integration tests for auth-required verification and fail-closed remediation.
- [x] T-045: Add e2e coverage or record why the local AuthKit route cannot be exercised end-to-end.

## Phase 6: Validation
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted tests for legalRepresentation invitations/profiles and auth resource checks.
- [x] T-904: Run `bun run test:e2e` if route/auth callback behavior changed or record the justified skip.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution artifact validation.
