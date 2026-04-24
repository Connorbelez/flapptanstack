# Chunk Context: chunk-06-validation-audit

## Goal
- Run required quality gates, verify GitNexus-detected scope, run the final spec-compliance audit, and close all execution artifacts truthfully.

## Relevant plan excerpts
- "Before finalizing, invoke `$linear-pr-spec-audit` against the same issue and the current PR or branch diff, then persist the verdict in `specs/<issue-key>/audit.md`."
- "Do not claim the issue is complete while the audit still has unresolved `MISSING` or `CONTRADICTED` items."
- "`bunx convex codegen`, `bun check`, `bun typecheck`, targeted checkout/webhook/listing/deal tests, `bun run test`, and `bun run review` pass before completion."

## Implementation notes
- `bun check` must run before manual lint/format fixes.
- E2E is required if a browser-visible mocked Stripe flow is introduced; otherwise the artifact and final report must explain why targeted Convex/component tests are the correct coverage.
- Final artifact validation must use `scripts/validate_execution_artifacts.py ENG-341 --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`.

## Existing code touchpoints
- `scripts/validate_execution_artifacts.py`: artifact gate.
- `package.json`: project quality commands.
- GitNexus CLI: `npx gitnexus detect_changes` is required before finalizing.
- `$linear-pr-spec-audit`: mandatory final audit skill for this workflow.

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- Targeted tests for checkout, webhook, listing, deal effects, and locking fee behavior.
- `bun run test`
- `bun run test:e2e` or documented non-applicability
- `bun run review`
- `npx gitnexus detect_changes`
- `$linear-pr-spec-audit`
- Final execution artifact validation.
