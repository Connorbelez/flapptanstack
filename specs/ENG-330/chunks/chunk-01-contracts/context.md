# Chunk Context: chunk-01-contracts

## Goal
- Establish the shared Velocity namespace with constants, TypeScript contracts, Convex validators, and stable exports used by downstream ingress, workspace, activation, UI, and harness issues.

## Relevant plan excerpts
- Boundary validators must be permissive at the upstream boundary and strict at the normalized/readiness boundary.
- `linkApplicationId` is the canonical upstream identity; `loanCode` is the staff locator.
- Only `Funded (6)` enables activation; `Complete (7)` before activation routes to remediation; Parked, Cancelled, and Declined stay non-actionable without new persisted workspace states.
- Activation remediation starts with package-owned `loanType` and `lienPosition`.
- Downstream issues must import stable DTOs, workflow source constants, and exception/readiness enums from a single Velocity namespace.

## Implementation notes
- Use `unknown` or `Record<string, unknown>` for raw provider payload preservation; do not introduce exported `any` types.
- Keep helpers pure and dependency-free where possible so tests can exercise contracts without Convex runtime setup.
- Convex validators should mirror exported contract shapes and be importable by `convex/schema.ts`.

## Existing code touchpoints
- New files under `convex/velocity/` are expected.
- `convex/mortgages/paymentFrequency.ts` provides current FairLend payment frequency values.
- `convex/admin/origination/validators.ts` models existing `loanType`, `lienPosition`, PAD evidence, listing overrides, and valuation draft shapes.
- GitNexus status after `npx gitnexus analyze .`: up to date at commit `dd81e64`.
- GitNexus impact for `convex/schema.ts`: MEDIUM risk; 10 direct import dependents, 0 affected processes.
- GitNexus impact for `appendAuditJournalEntry`: CRITICAL if modified; direct callers include seed helpers, `activateMortgageAggregate`, transition execution, audit evidence services, transfer mutations, and collection-plan execution. This issue will add a Velocity wrapper and will not modify the shared audit writer.

## Validation
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-330 --repo-root "/Users/connor/.codex/worktrees/76d1/fairlendapp" --stage ready-to-edit`: passed
- Targeted Velocity tests after contract implementation.
