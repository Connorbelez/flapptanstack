# Chunk: chunk-03-tests-validation-audit

- [x] T-210: Add backend tests for review permission enforcement, queue filtering, dossier projection shape, reviewer-note requirements, request-changes payload validation, and broker-note ingestion.
- [x] T-220: Add route/component tests for the admin review workspace.
- [x] T-230: Record why E2E and Storybook coverage are or are not required for this slice.
- [x] T-900: Run targeted tests for ENG-324.
- [x] T-901: Run `bunx convex codegen`.
- [x] T-902: Run `bun check`.
  - Full repo command blocked by unrelated baseline diagnostics; focused ENG-324 check passes.
- [x] T-903: Run `bun typecheck`.
- [x] T-910: Run `$linear-pr-spec-audit` and persist the verdict in `specs/ENG-324/audit.md`.
- [x] T-920: Resolve audit findings or record blockers.
  - Audit found no ENG-324 spec gaps. Recorded unrelated full-suite/full-check blockers in `audit.md`.
- [x] T-930: Run final execution artifact validation.
  - Final validation passes with the global `bun check` baseline blocker recorded.
