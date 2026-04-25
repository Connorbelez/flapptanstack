# Chunk: chunk-03-validation-audit

- [x] T-030: Add targeted backend and route tests for portal lookup, migrations, trusted host extraction, and root portal context resolution
- [x] T-031: Add E2E host-resolution coverage for local marketing/app/broker/unknown hosts, or record a non-applicability rationale
- [ ] T-900: Run repo quality gates, targeted tests, broader regression commands as needed, and `coderabbit review --plain`
  Fresh rerun on 2026-04-20 reconfirmed `bunx convex codegen`, `bun typecheck`, and focused Vitest pass. `bun check` still fails on unrelated repo-wide complexity diagnostics, and CodeRabbit still refuses the 366-file diff.
- [x] T-910: Run `$linear-pr-spec-audit` and persist the verdict in `specs/ENG-297/audit.md`
- [ ] T-920: Resolve audit findings or record blockers, run `gitnexus_detect_changes`, and close the execution checklist
  `git diff` reconciliation is complete and the artifacts validate for `--stage final --require-audit`, but the strict close-out validator still fails while T-900 and the repo-level checklist item remain open.
  Active follow-up scope on 2026-04-20: production↔local cross-host collisions are rejected in `assertPortalRegistryInvariants`; remaining work includes broader invariant test coverage and making the router/query cache consume `portalCacheKey` instead of only surfacing it in route context.
