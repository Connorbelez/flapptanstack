# Spec Audit: ENG-300 - Broker portal: define the v1 portal pricing policy contract

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against its merge base
- Last run: 2026-04-20T21:19:52Z
- Verdict: needs manual validation

## Findings
- [medium] Required quality gates are not fully green yet, so the issue is not ready to close purely from local automation. `bunx convex codegen` cannot run in this worktree without `CONVEX_DEPLOYMENT`, and `bun check` still fails on unrelated pre-existing repo-wide complexity diagnostics.
- [low] The repo workflow asks for `coderabbit review --plain` after a major unit of work, but the service refused to start because the worktree currently contains 390 changed files, above the review limit of 300.

## Coverage summary
- SATISFIED: 10
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 2

## Requirement ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | data model | Harden `portalPricingPolicies` into the explicit v1 broker-cut contract with deterministic lifecycle fields and indexes | `convex/schema.ts`, `convex/portals/validators.ts` | contract now includes `status`, `effectiveFrom`, `effectiveTo`, and required `brokerSplitPercent` |
| SATISFIED | capability | Reuse the existing `portals.pricingPolicyId` seam rather than adding a second pricing store | `convex/portals/pricing.ts` | selection logic respects the canonical pointer when present |
| SATISFIED | backend behavior | Select exactly one active policy deterministically and reject overlap or invalid references | `convex/portals/pricing.ts`, `convex/portals/__tests__/pricing.test.ts` | covers future-dated rows, invalid configuration, and ambiguous active windows |
| SATISFIED | negative contract | Keep portal pricing as a read-time projection instead of mutating canonical listing values | `convex/portals/pricing.ts`, `convex/listings/__tests__/queries.test.ts` | projection helper returns transformed listing data without patching stored rows |
| SATISFIED | projection contract | Only portal-facing return-like outputs are projected in v1 while structural fields stay canonical | `convex/portals/pricing.ts`, `convex/portals/__tests__/pricing.test.ts`, `convex/listings/__tests__/queries.test.ts` | projected fields are explicitly `interestRate` and `monthlyPayment` |
| SATISFIED | fail-closed behavior | Published portals without a valid active pricing policy fail explicitly; unpublished portals may stay setup-safe | `convex/portals/pricing.ts`, `convex/portals/__tests__/pricing.test.ts` | `requirePortalPricingSelection` raises explicit errors outside setup-safe unpublished cases |
| SATISFIED | shared math | Reuse one shared two-decimal rounder instead of adding another copy | `convex/listings/math.ts`, `convex/listings/queries.ts`, `convex/listings/projection.ts` | both existing listing surfaces now import the shared helper |
| SATISFIED | downstream seam | Expose importable loader and helper utilities for `ENG-301` without rolling out full portal queries here | `convex/portals/pricing.ts`, `convex/test/moduleMaps.ts` | loader and require helpers are importable and testable |
| SATISFIED | tests | Add focused unit coverage plus a thin integration proof over real listing query fixtures | `convex/portals/__tests__/pricing.test.ts`, `convex/listings/__tests__/queries.test.ts` | targeted Vitest run passed |
| UNVERIFIED | quality gates | `bunx convex codegen`, `bun check`, `bun typecheck`, and targeted tests pass | local command evidence | `bun typecheck` and targeted tests passed; codegen and `bun check` remain blocked by environment and unrelated repo-wide diagnostics |
| UNVERIFIED | workflow review | Run `coderabbit review --plain` after the major unit of work | local command evidence | blocked by CodeRabbit file-count limit in the worktree |

## Unresolved items
- Configure `CONVEX_DEPLOYMENT` in this worktree and rerun `bunx convex codegen`.
- Reconcile the unrelated repo-wide `bun check` diagnostics or isolate the branch in a cleaner worktree before claiming a fully green closeout.
- Re-run `coderabbit review --plain` from a smaller diff surface if the review artifact is still required.

## Next action
- Treat the pricing-contract implementation as landed and validation-complete at the feature level, but do not claim the issue fully closed until the blocked quality gates above are resolved or explicitly waived.
