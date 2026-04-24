# Chunk: chunk-03-audit-drift-validation

- [x] T-030: Add failing tests for post-live Velocity drift producing `live_drift_exception` and `post_live_drift` snapshots.
- [x] T-031: Implement post-live drift detection in the Velocity sync path without mutating canonical mortgage facts.
- [x] T-032: Assert package audit and mortgage audit payloads include Velocity package provenance, reviewer, activation attempt, and created canonical IDs.
- [x] T-033: Run targeted tests after each chunk and update chunk status artifacts.
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted Velocity activation regression tests.
- [x] T-904: Run broader `bun run test` if targeted tests pass in a reasonable runtime.
  - Attempted; failed on unrelated existing suites covering listing fixture/schema drift, auth architecture guard offenders, paginate guard, and collection attempt reconciliation auth setup.
- [x] T-910: Run `$linear-pr-spec-audit` against ENG-333 and the current branch diff.
- [x] T-920: Resolve audit findings or record blockers, then rerun artifact final validation.
