# Spec Audit: ENG-298 - Broker portal: make WorkOS sign-in, callback, and logout host-aware

- Audit skill: `$linear-pr-spec-audit`
- Review target: detached `HEAD` working tree diff after addressing the 2026-04-20 audit findings, reconciled against merge-base `2b458cf10d8fc6b0c78066ecf64811c900902ff1` from `origin/main`
- Last run: 2026-04-20 18:06 EDT
- Verdict: code addressed, live localhost validation blocked by external environment config

## Findings
1. `RESOLVED`: fresh users now get `users.homePortalId` assigned on the live auth sync path instead of relying on the migration-only backfill.
   - `convex/portals/homePortalAssignment.ts` now centralizes the FairLend/broker/org home-portal resolution rules.
   - `convex/auth.ts` now schedules `internal.auth.syncUserHomePortalAssignment` from `user.created`, out-of-order `user.updated`, membership events, and the `syncUserRelatedData` action.
   - `convex/portals/__tests__/registry.test.ts` now covers the freshly created marketing-host user case and verifies the FairLend app portal fallback.
2. `RESOLVED IN CODE`: localhost browser coverage now uses the canonical local host model and includes a dedicated host-aware smoke.
   - `playwright.config.ts`, `package.json`, and `e2e/helpers/host-aware-auth.ts` now align E2E to `localhost:3000` / `*.localhost:3000`, which matches the repo’s host contracts.
   - `e2e/auth.setup.ts` now seeds an explicit `app.localhost` admin auth state.
   - `e2e/auth/host-aware.spec.ts` now exercises same-host admin sign-in/sign-out on `app.localhost` and broker-host sign-in/sign-out on the assigned `*.localhost` broker portal, while staying self-contained instead of depending on inherited storage state.
   - `src/routes/e2e/session.tsx` now exposes the viewer home-portal assignment so the browser smoke can discover the assigned localhost broker host.
3. `BLOCKED (external config + deployment data)`: the remaining live browser proof failure is no longer a code gap.
   - The WorkOS hosted auth page rejects `http://app.localhost:3000/callback` with `This is not a valid redirect URI`, so same-host localhost callback validation cannot complete until the staging Redirects configuration allows that callback (or a matching wildcard).
   - Running `brokers/migrations:runPortalRegistryBackfill` on the dev deployment successfully created the FairLend app portal and cleared `usersMissingHomePortalCount`, but broker portal seeding still aborts on a duplicate `orgId` portal claim in the existing dev data. That leaves broker localhost coverage blocked on the deployment dataset even though the code path is now present.

## Coverage Summary
- `SATISFIED`: auth initiation remains host-aware, with same-host callback routing and signed state for marketing and portal hosts.
- `SATISFIED`: callback completion now has a live runtime path that can resolve `users.homePortalId` for fresh marketing-host sign-ins instead of failing closed.
- `SATISFIED`: sign-out remains host-aware across the shared logout plumbing.
- `SATISFIED IN CODE`: localhost/browser coverage now targets the canonical local host scheme and has dedicated host-aware smoke coverage.
- `BLOCKED EXTERNALLY`: end-to-end browser proof is still gated by WorkOS redirect registration and existing dev deployment portal data.

## Requirement Ledger
| Requirement | Status | Evidence |
| --- | --- | --- |
| Marketing-host auth preserves path and lands on marketing callback | `SATISFIED` | `src/lib/portal/auth-routing.ts`, `src/lib/portal/auth-initiation.ts`, `src/test/routes/auth-routes.test.ts` |
| Portal-host auth preserves originating host and signed portal context | `SATISFIED` | `src/lib/portal/auth-state.ts`, `src/lib/portal/auth-routing.ts`, `src/test/routes/auth-routes.test.ts` |
| Callback validates signed state before using host/portal data | `SATISFIED` | `src/routes/auth-complete.tsx`, `src/lib/portal/auth-state.ts`, `src/test/routes/auth-routes.test.ts` |
| Marketing callback resolves `users.homePortalId` and defaults generic auth to FairLend portal | `SATISFIED` | `convex/auth.ts`, `convex/portals/homePortalAssignment.ts`, `convex/portals/__tests__/registry.test.ts` |
| Portal callback re-resolves current portal and rejects wrong-portal access without silent redirect | `SATISFIED` | `src/lib/portal/auth-completion.ts`, `src/components/portal/WrongPortalState.tsx`, `src/test/routes/portal-auth-callback.test.tsx` |
| FairLend admins may bypass wrong-portal rejection via admin rules | `SATISFIED` | `src/lib/portal/auth-completion.ts`, `src/test/routes/portal-auth-callback.test.tsx` |
| Sign-out returns to same host class | `SATISFIED` | `src/lib/workos-sign-out.ts`, `src/hooks/use-host-aware-sign-out.ts`, `src/test/routes/auth-routes.test.ts` |
| Local auth uses `localhost` / `*.localhost` only | `SATISFIED IN CODE / BLOCKED IN ENV` | `playwright.config.ts`, `e2e/helpers/host-aware-auth.ts`, `e2e/auth/host-aware.spec.ts`, WorkOS currently rejects `http://app.localhost:3000/callback` in staging |

## Verification Results
- `PASS`: `bunx convex codegen`
- `PASS`: `bun typecheck`
- `PASS`: `bun run test -- convex/portals/__tests__/registry.test.ts src/test/routes/auth-routes.test.ts src/test/routes/portal-auth-callback.test.tsx`
- `PASS`: `bunx convex run portals/queries:resolvePortalByHost '{"host":"app.localhost:3000"}' --typecheck disable`
- `PASS`: `bunx convex run brokers/migrations:getPortalRegistryBackfillStatus '{}' --identity ... --typecheck disable`
  - Current status: `fairLendPortalExists: true`, `portalCount: 1`, `usersMissingHomePortalCount: 0`, `brokersMissingPortalCount: 2`
- `BLOCKED`: `bun run test:e2e -- e2e/auth/host-aware.spec.ts --project=authenticated --no-deps`
  - Current first failure reaches the WorkOS hosted page, but WorkOS rejects the same-host callback with `This is not a valid redirect URI` for `http://app.localhost:3000/callback`

## Recommended Next Actions
1. Add `http://app.localhost:3000/callback` and the matching localhost logout URI, or a permitted localhost wildcard, in the WorkOS staging Redirects configuration.
2. Resolve the duplicate broker `orgId` claim in the dev deployment data, then rerun `brokers/migrations:runPortalRegistryBackfill` so broker localhost portals exist for member-host validation.
3. Re-run `bun run test:e2e -- e2e/auth/host-aware.spec.ts --project=authenticated --no-deps` after the WorkOS and dev-data blockers are cleared.
