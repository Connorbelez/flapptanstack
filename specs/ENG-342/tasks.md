# Tasks: ENG-342 - Deal closing: add envelope attempts, webhooks, and signing exceptions

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, comments, Notion plan, supporting docs, and ENG-338 dependency context.
- [x] T-002: Scaffold execution artifacts with `scripts/init_execution_artifacts.py`.
- [x] T-003: Run GitNexus indexing and impact checks for planned existing-symbol edits.
- [x] T-004: Validate artifacts for `ready-to-edit`.

## Phase 2: Contracts And Schema
- [x] T-010: Add signing/envelope validators and TypeScript contracts in `convex/documents/contracts.ts` or a focused deal-signing contract module.
- [x] T-011: Add schema tables/indexes for envelope attempts, recipient progress, provider events, signing exceptions, and reissue lineage in `convex/schema.ts`.
- [x] T-012: Run Convex codegen after schema changes.

## Phase 3: Envelope Core
- [x] T-020: Create `convex/deals/envelopes.ts` with pure helpers for active attempt selection, next attempt number, required-recipient completion, signing order gate, token visibility, and exception classification.
- [x] T-021: Implement internal/public fluent endpoints for attempt creation, send/reissue/reminder recording, and attempt/recipient status updates.
- [x] T-022: Add pre-send validation that creates explicit signing exceptions for missing package, signatory mapping, generated artifact, provider config, or invalid recipient roster.

## Phase 4: Webhooks And Transition Gate
- [x] T-030: Add Documenso webhook verification helper/action without changing existing payment verification contracts.
- [x] T-031: Create `convex/deals/envelopeWebhooks.ts` with HTTP handler, event parser, durable event persistence, provider-event dedupe, and processing status updates.
- [x] T-032: Normalize sent/opened/signed/completed/rejected/voided events into attempt and recipient state idempotently.
- [x] T-033: Emit `ALL_PARTIES_SIGNED` through the internal transition mutation only when the active required recipient set is verified complete and completion has not already emitted.

## Phase 5: Projections And Package Surface
- [x] T-040: Add access-checked signing projection queries for admin/lawyer/participant consumers with current-recipient token scoping.
- [x] T-041: Integrate envelope state into `readDealDocumentPackageSurface` and `getPortalDealDetail` while preserving non-downloadable signable placeholders.
- [x] T-042: Add or adjust internal package helpers needed to create attempts from signable `dealDocumentInstances`.

## Phase 6: Tests
- [x] T-050: Add focused backend tests for attempt creation, missing signatory config, reissue lineage, and projection token scoping.
- [x] T-051: Add focused backend tests for invalid secret, duplicate/out-of-order webhooks, rejection/void, provider mismatch, and exactly-once completion transition.
- [x] T-052: Update package surface tests for envelope state and signable placeholder download behavior.

## Phase 7: Validation
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted envelope/webhook/package tests.
- [ ] T-904: Run `bun run test`.
  - Blocked: full suite fails 26 existing tests outside the ENG-342 envelope/package path; targeted ENG-342 tests pass.
- [ ] T-905: Run `bun run review`.
  - Blocked: CodeRabbit refuses the branch because it sees 952 files, over its 300-file limit.
- [x] T-906: Run `gitnexus_detect_changes` equivalent via GitNexus before closeout.
  - Note: this GitNexus CLI has no `detect_changes` command; ran `npx gitnexus status`, `npx gitnexus analyze`, and `git diff` scope checks as the available equivalent.

## Phase 8: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against ENG-342 and the current branch diff.
- [x] T-920: Persist audit verdict in `specs/ENG-342/audit.md`.
- [ ] T-930: Resolve audit findings or record explicit blockers.
  - Blocked by the `bun run test` and `bun run review` gates above.
