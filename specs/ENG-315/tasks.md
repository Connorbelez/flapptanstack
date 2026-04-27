# Tasks: ENG-315 - Broker onboarding: lock verification-provider and auth contracts

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning And Blast Radius
- [x] T-001: Gather Linear and Notion context, confirm scope boundaries, and finalize the execution-artifact chunk plan
- [x] T-002: Run GitNexus impact analysis for every existing symbol touched by ENG-315, with special focus on `convex/auth/permissionCatalog.ts`, auth-context seams, and onboarding permission consumers

## Phase 2: Shared Contracts And Policy
- [x] T-010: Create `shared/brokerOnboarding/contracts.ts` with normalized verification snapshot, recommendation vocabulary, reason codes, evidence references, and province/policy types
- [x] T-011: Create `convex/onboarding/verification/interface.ts` with exact provider contracts named `RegulatorDirectoryProvider`, `IdentityVerificationProvider`, and `EmailVerificationContract`
- [x] T-012: Create `convex/onboarding/verification/config.ts` with typed ownership for provider mode, thresholds, freshness windows, province enablement, and fallback behavior

## Phase 3: Provider Resolution And Email Gate
- [x] T-020: Create `convex/onboarding/verification/registry.ts` so provider mode selects mock, imported-data, or future live implementations without changing business-layer call sites
- [x] T-021: Implement deterministic mock regulator and mock identity providers
- [x] T-022: Add the placeholder imported-data regulator adapter seam for ENG-318 without introducing the backing data pipeline in this issue
- [x] T-023: Create `convex/onboarding/verification/workosEmailVerification.ts` with a WorkOS-backed email-verification contract and explicit pre-IDV gating helpers

## Phase 4: Permission Contract Alignment
- [x] T-030: Make the onboarding review/manage ownership explicit in `convex/auth/permissionCatalog.ts`
- [x] T-031: Align `docs/architecture/rbac-and-permissions.md` with the explicit onboarding review/manage contract

## Phase 5: Focused Test Coverage
- [x] T-040: Add `src/test/convex/onboarding/verification-contracts.test.ts` for provider selection, normalized snapshot shape, and fail-closed recommendation mapping
- [x] T-041: Add `src/test/convex/onboarding/workos-email-verification.test.ts` for WorkOS-backed email-verification normalization and guard behavior
- [x] T-042: Add or update auth permission/doc-alignment coverage so the onboarding review/manage contract cannot silently drift again

## Phase 6: Validation And Audit
- [x] T-900: Run targeted tests for the ENG-315 contract-freeze surface
- [x] T-910: Run `bunx convex codegen`, `bun check`, and `bun typecheck`
- [x] T-920: Run `$linear-pr-spec-audit` against the current branch diff and persist the verdict in `specs/ENG-315/audit.md`
- [x] T-921: Resolve audit findings or record explicit blockers and rerun the audit if required
