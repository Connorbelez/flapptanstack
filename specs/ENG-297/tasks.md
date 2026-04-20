# Tasks: ENG-297 - Broker portal: establish portal registry and host-resolution context

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Scaffold `specs/ENG-297/` and populate the execution artifacts from the Linear issue and attached Notion plan
- [x] T-002: Read the issue, plan, architecture/design docs, and current repo touchpoints for schema, migrations, auth, and root routing
- [x] T-003: Run GitNexus analyze plus pre-edit impact checks for the planned existing symbols, or record any CLI blind spots before code edits
  GitNexus CLI indexing succeeded locally. Pre-edit impacts for `backfillBrokerOrgId`, `backfillLenderOrgId`, `runOrgScopeEntityBackfill`, `fetchWorkosAuth`, and `getRouter` were all `LOW`; `sanitizeRedirectPath` is `CRITICAL`, so auth redirect behavior remains out of scope for this slice.

## Phase 2: Portal Schema And Backend Contract
- [x] T-010: Update `convex/schema.ts` with `users.homePortalId`, `portals`, and thin placeholder `portalLandingPages` / `portalPricingPolicies` tables plus required indexes and comments
- [x] T-011: Create `convex/portals/validators.ts` and `convex/portals/queries.ts` for typed portal registry lookups and serializable portal data
- [x] T-012: Extend `convex/brokers/migrations.ts` with FairLend portal seed, broker portal backfill, `homePortalId` backfill, and status helpers

## Phase 3: Root Resolution And Runtime Wiring
- [x] T-020: Create `src/lib/portal/request-host.ts` and `src/lib/portal/host-resolution.ts` for trusted host extraction, canonicalization, reserved-host handling, and fail-closed classification
- [x] T-021: Create `src/lib/portal/portal-cache-key.ts` and `src/components/portal/portal-state-boundary.tsx`
- [x] T-022: Compose portal resolution into `src/routes/__root.tsx` and the minimal consumer surface in `src/routes/index.tsx`, `src/start.ts`, and `src/router.tsx` without changing auth callback behavior

## Phase 4: Tests, Validation, And Audit
- [x] T-030: Add targeted backend and route tests for portal lookup, migration/backfill behavior, trusted host extraction, and root portal-context resolution
- [x] T-032: Add route-level proof that blocked hosts keep the `/` child route inert and redirect non-root paths before child loaders can run
- [x] T-031: Add E2E host-resolution coverage for marketing/app/broker/unknown local hosts, or record an explicit non-applicability rationale if route/integration coverage is sufficient
  Recorded non-applicability: the current Playwright harness does not provide a multi-host `localhost` / `app.localhost` / `*.localhost` setup, so this slice is covered by focused route and Convex integration tests instead.
- [ ] T-900: Run `bunx convex codegen`, `bun check`, `bun typecheck`, targeted Vitest commands, broader regression commands as needed, and `coderabbit review --plain`
  Fresh rerun on 2026-04-20 confirmed `bunx convex codegen`, `bun typecheck`, and `bun run test -- convex/portals/__tests__/registry.test.ts src/test/routes/portal-context.test.tsx src/test/routes/portal-query-cache-scope.test.ts` pass. `bun check` still fails on unrelated repo-wide complexity diagnostics, and `coderabbit review --plain` still aborts because the branch diff contains 366 files, above the tool's 300-file limit.
- [x] T-910: Run `$linear-pr-spec-audit` against the current branch diff and persist the verdict in `specs/ENG-297/audit.md`
- [ ] T-920: Resolve audit findings or record blockers, run `gitnexus_detect_changes` plus final diff reconciliation, and close the execution checklist
  Duplicate-host rejection is now enforced in the portal backfill/write path and covered by focused tests, and the router query hash now consumes the resolved `portalCacheKey`.
  The ENG-297 wording is now aligned to the blessed minimal public pre-auth root-context contract, so the spec and implementation no longer disagree about leaked portal identifiers.
  Remaining blockers are explicit rather than hidden: `bun check` still fails on unrelated repo-wide complexity diagnostics, `coderabbit review --plain` cannot start because the branch diff is over the tool's 300-file limit, and the local GitNexus CLI does not expose a `detect_changes` command so scope reconciliation uses `git diff` instead.
  Artifact validation is structurally green with `--stage final --require-audit`, but the strict close-out validator still fails by design while T-900 and the repo-level quality-gate checklist item remain open.
