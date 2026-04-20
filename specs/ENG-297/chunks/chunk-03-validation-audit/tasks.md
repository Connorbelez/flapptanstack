# Chunk: chunk-03-validation-audit

- [x] T-030: Add targeted backend and route tests for portal lookup, migrations, trusted host extraction, and root portal context resolution
- [x] T-031: Add E2E host-resolution coverage for local marketing/app/broker/unknown hosts, or record a non-applicability rationale
- [ ] T-900: Run repo quality gates and targeted tests, plus any broader regression commands needed for scope. Any CodeRabbit review is human-owned.
  Fresh rerun on 2026-04-20 reconfirmed `bunx convex codegen`, `bun typecheck`, and focused Vitest pass. `bun check` still fails on unrelated repo-wide complexity diagnostics.
- [x] T-910: Run `$linear-pr-spec-audit` and persist the verdict in `specs/ENG-297/audit.md`
- [ ] T-920: Resolve audit findings or record blockers, run `gitnexus_detect_changes`, and close the execution checklist
  `git diff` reconciliation is complete and the artifacts validate for `--stage final --require-audit`, but the strict close-out validator still fails while T-900 and the repo-level checklist item remain open.
  Active follow-up scope on 2026-04-20: enforce duplicate-host rejection in the portal write/backfill path, add explicit invariant coverage, and make the router/query cache consume `portalCacheKey` instead of only surfacing it in route context.
