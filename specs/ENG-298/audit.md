# Spec Audit: ENG-298 - Broker portal: make WorkOS sign-in, callback, and logout host-aware

- Audit skill: `$linear-pr-spec-audit`
- Review target: detached `HEAD` working tree diff, reconciled against merge-base `2b458cf10d8fc6b0c78066ecf64811c900902ff1` from `origin/main`
- Last run: 2026-04-20 17:13 EDT
- Verdict: needs manual validation

## Findings
- `UNVERIFIED`: live `app.localhost` and broker-host `*.localhost` auth round trips were not executed end-to-end in this session. The helper/config changes are in place and targeted tests passed, but there is no recorded browser proof yet.
- `BLOCKER`: the repo-required `bun check` gate still fails on pre-existing Biome complexity diagnostics outside the ENG-298 diff, so the implementation cannot be closed out as fully green.
- `BLOCKER`: `coderabbit review --plain` could not produce a usable report in this detached/dirty worktree. The default run exceeded the 300-file review limit, and the narrowed uncommitted file run did not yield a final review summary in-session.

## Coverage summary
- `SATISFIED`: sign-in and sign-up now build host-aware WorkOS requests using same-origin callback completion and signed portal auth state.
- `SATISFIED`: callback completion routes marketing-host users through `users.homePortalId`, keeps valid portal-host users on-host, and renders explicit wrong-portal rejection with FairLend admin bypass.
- `SATISFIED`: sign-out now returns users to the same host class they started from via shared logout plumbing used by the public header, sign-out route, admin user menu, and WorkOS demo surface.
- `SATISFIED`: targeted regression coverage passed with `bun run test -- convex/portals/__tests__/registry.test.ts src/test/routes/auth-routes.test.ts src/test/routes/portal-auth-callback.test.tsx`, `bun typecheck`, and `bunx convex codegen`.

## Unresolved items
- Run a live browser validation for `http://app.localhost:<port>/sign-in` and a broker-host `http://<slug>.localhost:<port>/sign-in` / sign-out round trip.
- Clear, waive, or separately fix the unrelated repo-wide `bun check` complexity diagnostics if a fully green closeout is required.
- Re-run CodeRabbit once the review target is narrowed enough to produce a stable report.

## Next action
- Resolve or waive the remaining repo/tooling blockers, then rerun the final artifact validation gate.
