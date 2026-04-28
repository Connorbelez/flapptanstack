# Chunk: chunk-04-docs-validation-audit

- [x] T-040: Update contract docs so downstream issues know which helpers and table shapes to import.
- [x] T-041: Run `bunx convex codegen` and include generated Convex type updates.
- [x] T-900: Run `bun check`.
- [x] T-901: Run `bun typecheck`.
- [x] T-902: Run targeted legalRepresentation/checkout/dealAccess tests.
- [x] T-903: Run `bun run test` or record explicit blocker.
- [x] T-904: Run `gitnexus_detect_changes` equivalent and verify affected scope.
- [x] T-910: Run `$linear-pr-spec-audit` for ENG-359 against the current branch diff.
- [x] T-920: Persist audit verdict in `specs/ENG-359/audit.md`.
- [x] T-930: Resolve audit findings or record blockers.
- [x] T-940: Validate execution artifacts at the final stage.
