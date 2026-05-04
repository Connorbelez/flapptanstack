# Tasks: ENG-343 - Deal closing: harden funds confirmation and close-side effects

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, comments, linked Notion implementation plan, supporting architecture docs, upstream ENG-338/ENG-342 contracts, and repo instructions.
- [x] T-002: Scaffold execution artifacts and define chunk plan for implementation, validation, and audit.
- [x] T-003: Run GitNexus analyze/status and required impact checks before editing existing symbols.
- [x] T-004: Validate execution artifacts at `ready-to-edit`.

## Phase 2: Evidence Schema And Contracts
- [x] T-010: Add schema tables/indexes for funds confirmation evidence, signed archive records, and close effect outcome/exception records.
- [x] T-011: Add shared funds evidence, archive, outcome, idempotency key, and projection helpers in a dedicated close evidence module.
- [x] T-012: Add validators/types for `FundsReceiptSource`, manual admin evidence, provider evidence, archive status, effect outcome kind, and participant-safe receipt summaries.

## Phase 3: Funds Confirmation And Transition Wiring
- [x] T-020: Replace `confirmFundsReceipt` with provider/manual evidence resolution, validation, durable recording, compatible replay handling, and safe exception recording.
- [x] T-021: Add manual FairLend staff admin funds confirmation mutation that validates authority, actor, timestamp, evidence note, attachments, and emits governed `FUNDS_RECEIVED`.
- [x] T-022: Preserve or extend transfer pipeline leg 2 provider path so `FUNDS_RECEIVED` can be tied to pipeline id, leg 2 transfer id, provider code, and same-deal evidence.
- [x] T-023: Reject or exception missing, mismatched, incompatible duplicate, cancelled, failed, and non-funding evidence paths without direct status patches.

## Phase 4: Archive And Close Effect Outcomes
- [x] T-030: Replace `archiveSignedDocuments` with active completed envelope/artifact archive handling and visible missing-artifact blocker recording.
- [x] T-031: Add close effect outcome recording for funds evidence, signed archive, reservation commit, proration, reroute, and lawyer access cleanup without duplicating side effects.
- [x] T-032: Preserve retry/idempotency behavior for reservation commit, proration, payment reroute, and lawyer access revocation.

## Phase 5: Projections And Tests
- [x] T-040: Extend admin/internal deal projections with funds source, archive status, close effect outcomes, and blocking exceptions.
- [x] T-041: Expose participant-safe close receipt summary without admin-only operational detail.
- [x] T-050: Add targeted Convex tests for manual evidence, provider leg 2 evidence, duplicate/out-of-order provider events, missing evidence, cancelled/failed protection, archive blockers, partial retries, and projection visibility.
- [x] T-051: Add or update e2e/Storybook notes; record why UI tests/stories are not applicable if this remains backend-only contract work.

## Phase 9: Validation And Audit
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted close/transfer/deal tests.
- [x] T-904: Run `bun run test`.
- [x] T-905: Run `bun run review`.
- [x] T-910: Run `$linear-pr-spec-audit` against ENG-343 and current branch diff.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final execution artifact validation and GitNexus change detection.
