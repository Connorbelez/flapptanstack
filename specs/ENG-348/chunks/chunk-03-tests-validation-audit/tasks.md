# Chunk: chunk-03-tests-validation-audit

- [ ] T-213: Add e2e coverage for participant happy path, unauthorized denial, and completed receipt.
  - Playwright coverage was added but execution is blocked by dev deployment schema/data drift.
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted participant query/route/component tests.
- [ ] T-904: Run `bun run test`.
  - Ran; fails in unrelated `convex/demo/__tests__/ampsE2e.test.ts`.
- [ ] T-905: Run `bun run test:e2e`.
  - Ran focused participant e2e; blocked by dev Convex deployment not exposing the new query because `bunx convex dev --once` cannot pass schema validation against existing data.
- [ ] T-906: Run `bun run review`.
- [ ] T-910: Run `$linear-pr-spec-audit` against ENG-348 and the current branch diff.
- [ ] T-920: Resolve audit findings or record blockers.
- [ ] T-930: Run final execution artifact validation with audit and all checklist/tasks closed.
