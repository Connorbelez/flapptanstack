# Execution Status: ENG-297 - Broker portal: establish portal registry and host-resolution context

- Overall status: blocked
- Current phase: chunk-03-validation-audit
- Current chunk: chunk-03-validation-audit
- Last updated: 2026-04-20T20:15:50Z

## Active focus
- Close out the clarified-contract verification pass with the minimal public root context blessed explicitly in the issue/spec artifacts and route-level blocked-host proof added.

## Blockers
- `bun check` fails on pre-existing repo-wide complexity diagnostics outside the ENG-297 files.
- `coderabbit review --plain` cannot start because the current branch/PR diff contains 366 files, over the service limit of 300.
- The local GitNexus CLI does not expose a `detect_changes` command, so final scope verification falls back to explicit `git diff` reconciliation.

## Notes
- Linear and Notion context is gathered from ENG-297 plus the implementation plan, architecture doc, technical design doc, and goal page.
- GitNexus MCP tools are not exposed in this session; the local GitNexus CLI index was rebuilt successfully for the required pre-edit impact pass.
- Low-risk impacts were recorded for the planned schema/migration touchpoints. `sanitizeRedirectPath` resolved as `CRITICAL`, so auth redirect behavior stays out of scope for ENG-297.
- Portal registry, root host resolution, and focused test coverage are implemented. Remaining work is validation bookkeeping rather than missing ENG-297 feature scope.
- Fresh reruns on 2026-04-20 reconfirmed `bunx convex codegen`, `bun typecheck`, and the focused Vitest suite, including the new route-module blocked-host proof, all pass. `bun check` and CodeRabbit remain blocked for the same external reasons already captured above.
- The ENG-297 contract is now explicitly interpreted as a minimal public pre-auth root context. Broker/org/pricing/landing identifiers remain on the persisted portal row and admin/authenticated lookups, but they are intentionally excluded from the public host-resolution surface.
- `validate_execution_artifacts.py --stage final --require-audit` now passes. The stricter `--require-all-tasks-closed --require-all-checklist-closed` variant still fails because T-900 and the repo-level quality-gate checklist item are intentionally left open.
- The live follow-up audit findings were addressed on 2026-04-20: portal duplicate-host rejection now happens in the write/backfill path, and the router query hash now consumes the resolved `portalCacheKey`.
- The issue is still blocked from full closeout by repo-level validation constraints (`bun check`, CodeRabbit diff-size limit, and the missing GitNexus `detect_changes` CLI command), not by an open ENG-297 feature gap.
