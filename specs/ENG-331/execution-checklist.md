# Execution Checklist: ENG-331 - Velocity package: build webhook ingestion and full-deal sync spine

## Requirements From Linear
- [x] Register the Velocity webhook entrypoint in `convex/http.ts` and implement an authenticated handler module for `POST /api/velocity/webhook`.
- [x] Persist raw webhook events with webhook-agent identity and connector credential scope before downstream processing.
- [x] Fetch the full deal by `loanCode` against the documented contract, with opaque deal-link fallback only when Newton supplies it.
- [x] Ensure webhook handling is notification-only; never patch package state from webhook payload fields alone.
- [x] Normalize full deals into the shared Velocity core DTO, validate `linkApplicationId`, and create or update the workspace plus snapshots through one reusable path.
- [x] Use explicit webhook-event and full-deal idempotency keys so duplicate delivery cannot create duplicate workspaces, snapshots, or activation work.
- [x] Recompute readiness and open package exceptions when identity, mapping, or required-core-field rules fail.
- [x] Expose a manual `Sync now` backend surface that runs the same fetch/normalize/upsert/readiness pipeline as webhook processing.
- [x] Write ingress and sync-side lifecycle events through the Velocity package audit pipeline.

## Definition Of Done From Linear
- [x] The Velocity webhook route exists, authenticates requests, and persists raw webhook rows before package mutation.
- [x] Webhook and manual sync converge on one normalization and workspace-upsert pipeline.
- [x] Workspace creation and snapshotting are idempotent on repeated webhook delivery and repeated full-deal hashes.
- [x] Identity failures and normalization problems become explicit package exceptions with enough provenance for operator diagnosis.
- [x] Sync-side audit entries include webhook agent and credential-scope context.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for backend sync behavior, normalization, idempotency, readiness, exceptions, and manual-sync convergence.
- [x] E2E tests are not expected for ENG-331 because this issue is backend ingestion/sync spine only and adds no operator UI workflow.
- [x] Storybook stories are not applicable because this issue introduces no reusable UI components or screens.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
  - Passed after baselining Biome's diagnostic display cap with `--max-diagnostics=300`; existing warning-level diagnostics remain visible.
- [x] `bun typecheck` passed.
- [x] Targeted Velocity Convex tests passed.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
