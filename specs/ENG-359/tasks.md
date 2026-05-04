# Tasks: ENG-359 - Legal representation: establish lawyer compliance contracts

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize summary, checklist, task list, chunk plan, and GitNexus impact notes.
- [x] T-002: Validate execution artifacts at the ready-to-edit stage.

## Phase 2: Schema And Validators
- [x] T-010: Add legal-representation validators for LSO lawyer rows, lawyer profiles, verification evidence, guest invitations, representation engagements, provider results, and checkpoint decisions.
- [x] T-011: Add schema tables and required indexes for `lsoLawyers`, `lawyerProfiles`, `lawyerVerifications`, `lawyerInvitations`, and `representationEngagements`.
- [x] T-012: Extend checkout selected-lawyer snapshot validators/types to accept optional LSO metadata while preserving current platform/manual guest snapshots.

## Phase 3: Legal Representation Services
- [x] T-020: Add normalization helpers for names, emails, bar numbers, jurisdictions, restriction statuses, and reason codes.
- [x] T-021: Add `LawyerVerificationProvider` interface plus deterministic manual/test provider behavior.
- [x] T-022: Add immutable verification write/read helpers and currentness query helpers by deal, profile/auth ID, check type, bar/jurisdiction, and expiry.
- [x] T-023: Add checkpoint helper functions for selection, LAWYER_VERIFIED, REPRESENTATION_CONFIRMED, and platform activation decisions.
- [x] T-024: Add typed fixture builders for downstream tests and seeds.

## Phase 4: Tests
- [x] T-030: Add selectedLawyer compatibility tests for legacy platform, legacy manual guest, and LSO-enriched snapshots.
- [x] T-031: Add legal-representation unit tests for normalization, provider outcomes, checkpoint decisions, stale evidence, failed/requires_review evidence, and duplicate bar/email edge cases.
- [x] T-032: Add Convex contract tests for verification immutability, queryability, schema indexes, fixture builders, and preservation of dealAccess role semantics.

## Phase 5: Docs And Generated Types
- [x] T-040: Update contract docs so downstream issues know which helpers and table shapes to import.
- [x] T-041: Run `bunx convex codegen` and include generated Convex type updates.

## Phase 8: Validation
- [x] T-900: Run `bun check`.
- [x] T-901: Run `bun typecheck`.
- [x] T-902: Run targeted legalRepresentation/checkout/dealAccess tests.
- [x] T-903: Run `bun run test` or record explicit blocker.
  - Blocker recorded: full-suite failures remain outside ENG-359 scope in mortgage blueprint mappings, cash ledger regression verification, and Velocity activation/mock tests.
- [x] T-904: Run `gitnexus_detect_changes` equivalent and verify affected scope.
  - Local GitNexus index was rebuilt and `npx gitnexus status` reports the worktree index is up to date. The MCP `gitnexus_detect_changes` tool is unavailable in this session; CLI impact could not resolve newly added uncommitted helper symbols, so changed-file scope was verified with `git diff --name-only` and targeted tests.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` for ENG-359 against the current branch diff.
- [x] T-920: Persist audit verdict in `specs/ENG-359/audit.md`.
- [x] T-930: Resolve audit findings or record blockers.
- [x] T-940: Validate execution artifacts at the final stage.
