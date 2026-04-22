# Spec Audit: ENG-315 - Broker onboarding: lock verification-provider and auth contracts

- Audit skill: `$linear-pr-spec-audit`
- Review target: issue-local `ENG-315` worktree delta in the current detached checkout; broader `origin/main...HEAD` history in this worktree is not attributable to this issue alone
- Last run: 2026-04-22T19:49:35Z
- Verdict: ready

## Findings
- none

## Coverage Summary
- SATISFIED: 10
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0
- OUT_OF_SCOPE: 2

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | capability | Cross-runtime broker-onboarding verification contracts must exist in code, not prose only | `shared/brokerOnboarding/contracts.ts` | Includes normalized snapshot shape, recommendation vocabulary, reason codes, province types, and evidence references |
| SATISFIED | provider seam | Exact provider contracts named `RegulatorDirectoryProvider`, `IdentityVerificationProvider`, and `EmailVerificationContract` must be frozen for downstream work | `convex/onboarding/verification/interface.ts` | Contract names match the issue language and normalize provider-facing inputs/outputs |
| SATISFIED | config ownership | Typed config ownership must cover provider mode, thresholds, freshness windows, province enablement, and fallback behavior | `convex/onboarding/verification/config.ts` | Defaults and override surface are explicit and reusable |
| SATISFIED | integration contract | Provider selection must be strategy-selected instead of leaking vendor branching into business-layer code | `convex/onboarding/verification/registry.ts` | Registry resolves mock, imported-data, and unavailable live/sandbox implementations from config or injected overrides |
| SATISFIED | integration contract | Deterministic mock regulator and IDV adapters plus a placeholder imported Ontario regulator seam must exist | `convex/onboarding/verification/providers/mockRegulator.ts`, `convex/onboarding/verification/providers/mockIdentity.ts`, `convex/onboarding/verification/providers/importedFsra.ts` | Imported FSRA remains a seam only and does not introduce the backing data pipeline in this issue |
| SATISFIED | auth | A WorkOS-backed email-verification contract must make `verified email before trusted IDV` structural and testable | `convex/onboarding/verification/workosEmailVerification.ts`, `src/test/convex/onboarding/workos-email-verification.test.ts` | Uses WorkOS-backed normalized input instead of introducing a second source of truth |
| SATISFIED | fail-closed behavior | Unsupported provinces, stale regulator data, malformed callbacks, unavailable providers, and missing config must fail closed into explicit outcomes | `shared/brokerOnboarding/contracts.ts`, `src/test/convex/onboarding/verification-contracts.test.ts` | Recommendation helper now has direct coverage for missing config, malformed callback, unavailable provider, stale data, and unsupported province outcomes |
| SATISFIED | RBAC contract | `onboarding:review` and `onboarding:manage` ownership must be explicit in runtime and canonical docs | `convex/auth/permissionCatalog.ts`, `docs/architecture/rbac-and-permissions.md`, `src/test/auth/permissions/onboarding-permission-contract.test.ts` | Runtime consumers and doc language are aligned and protected by test coverage |
| SATISFIED | tests | Focused automated coverage must lock provider selection, normalization, email-verification gating, fail-closed recommendation mapping, and permission/doc alignment | `src/test/convex/onboarding/verification-contracts.test.ts`, `src/test/convex/onboarding/workos-email-verification.test.ts`, `src/test/auth/permissions/onboarding-permission-contract.test.ts` | Targeted tests passed locally |
| SATISFIED | validation | Required repo gates must pass before closeout | `bunx convex codegen`, `bun check`, `bun typecheck` | `bun check` completes successfully with pre-existing complexity warnings but no errors |
| OUT_OF_SCOPE | data model | Do not create the broker application aggregate or `fsraLicenses` in this issue | current diff | No new schema or aggregate wiring was introduced |
| OUT_OF_SCOPE | workflow/UI | Do not build the production broker onboarding wizard in this issue | current diff | No route, screen, or operator workflow surface was added |

## Open Questions
- GitNexus CLI in this session exposes `impact`, `context`, and `query`, but not a `detect-changes` subcommand. Scope confirmation used `git diff --name-only` plus `git ls-files --others --exclude-standard` as the closeout fallback.
- The current checkout is detached and sits on top of a much larger branch diff versus `origin/main`, so this audit intentionally judged the `ENG-315` files added or modified in the worktree rather than the full historical branch delta.

## Next action
- ENG-315 is ready for downstream implementation work that consumes these frozen verification and auth contracts.
