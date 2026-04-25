# Chunk: chunk-05-tests-validation

- [x] T-800: Add or update seeded e2e coverage for lawyer queue/workspace, representation confirmation, package approval, and revoked access/read-only behavior.
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted lawyer Convex and route/component tests.
- [x] T-904: Run `bun run test`.
- [ ] T-905: Run `bun run test:e2e`. Blocked/failing outside ENG-347: shared e2e auth/demo suites fail, and the ENG-347 targeted browser spec cannot deploy its Convex seeder until existing dev data with `portals.portalType = "mic"` is migrated or admitted by schema.
- [x] T-906: Run `bun run review`.
- [x] T-910: Run `$linear-pr-spec-audit` against ENG-347 and current branch diff.
- [x] T-920: Persist audit verdict in `specs/ENG-347/audit.md`.
- [x] T-930: Resolve audit findings or record blockers, rerun audit if needed, and revalidate final execution artifacts.
