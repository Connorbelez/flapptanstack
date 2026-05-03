# File Workspace E2E Fixtures

The File Workspace E2E suite uses a gated Convex fixture API plus Playwright
helpers to create deterministic workspaces, files, links, participants, and
security evidence. The fixture entry points live in
`convex/test/fileWorkspaceE2e.ts`; browser helpers live in
`e2e/helpers/file-workspace.ts`; browser journeys live under
`e2e/file-workspace`.

## Enablement

The Convex fixture API is disabled by default. Enable it only in local or test
deployments with one of these environment variables:

```sh
FILE_WORKSPACE_E2E_ENABLED=true
```

or:

```sh
ALLOW_TEST_AUTH_ENDPOINTS=true
```

The Playwright setup also requires the existing WorkOS E2E login variables:

```sh
TEST_ACCOUNT_EMAIL=...
TEST_ACCOUNT_PW=...
VITE_CONVEX_URL=...
```

The File Workspace project uses its own storage state at
`.auth/file-workspace-user.json`, created by `e2e/file-workspace.setup.ts`.
It intentionally avoids the broader admin/member setup so this suite can run
without depending on unrelated organization-switch states. The Playwright
project runs against `app.localhost:<E2E_PORT>` because `localhost:<E2E_PORT>` is
treated as a portal host and intentionally fails closed when no portal is
published for that hostname.

## Running

Run the focused browser suite:

```sh
bun run test:e2e -- e2e/file-workspace
```

The deterministic local host is `app.localhost:3000`. Do not switch to a fresh
high port unless that `app.localhost:<port>` host has also been seeded as an
active application portal; otherwise the app intentionally redirects to the
portal unavailable state before the File Workspace routes load. If port 3000 is
already serving a non-E2E process, stop that process and rerun the focused suite
so Playwright can start Vite with `VITE_E2E=true`.

Run the lower-level File Workspace coverage:

```sh
bun run test -- convex/fileWorkspace src/test/file-workspace src/test/routes
```

Regenerate Convex API types after changing fixture exports:

```sh
bunx convex codegen
```

## Seeded Data Shape

Each run uses a URL-safe `runId` and names all boxes with the prefix
`File Workspace E2E <runId>`. Cleanup scopes to that prefix and to fixture
users whose auth IDs start with `file-workspace-e2e:<runId>`.

The base fixture creates:

- Current signed-in user as manager on the manager, public, magic, and suspended boxes.
- Stable fixture users for admin, manager, editor, viewer, and unrelated roles.
- Active manager, editor, viewer, public-link, and magic-link boxes.
- A suspended box for unavailable workspace assertions.
- A nested folder tree rooted at `Funding Conditions`.
- Public, magic, expired, revoked, and tampered-link tokens.

`seedDefaultFileWorkspaceFixture` attaches files for:

- Clean preview/download behavior.
- Pending scan quarantine.
- Rejected scan quarantine.
- Scan error state.
- Admin-released file state.
- Soft-deleted retention-blocked file.
- Public-link clean file.
- Magic-link clean file.

## Cleanup

Every browser test wraps seeded data in `try/finally` and calls
`cleanupFixture(runId)`. Cleanup deletes scoped boxes, nodes, versions, links,
participants, comments, tags, activity events, security events, uploaded storage
objects, and stable fixture users. If a run is interrupted, rerun cleanup by
calling `api.test.fileWorkspaceE2e.cleanupFixture` with the interrupted `runId`.

## Coverage Map

`workspace.spec.ts` covers authenticated creation, browser-driven folder
creation, browser-driven upload with pending scan quarantine, workspace
navigation, deep-tree keyboard navigation, quarantine states, clean-file
preview/download affordances, replacement version visibility, upload failure,
suspended box fail-closed behavior, mobile list-first ordering, mobile overflow,
and attached desktop/mobile screenshots.

`public-links.spec.ts` covers public and magic view-only shares, hidden
authenticated-only surfaces, enabled download policy, expired/revoked links, and
tampered-token failure.

`security-and-retention.spec.ts` covers browser-driven manager participant
invite, role change, and removal, viewer and editor denied management attempts,
and retention-blocked permanent deletion. Platform-admin scan release success and
non-admin scan release denial are covered by
`convex/fileWorkspace/__tests__/scanMutations.test.ts`, which avoids depending on
the WorkOS role assigned to the browser E2E account.

## Inspecting Failures

Playwright writes failure context under `test-results/` and the HTML report under
`playwright-report/`. Use the failed test title and project name to find the
matching folder. For browser screenshots or trace review, run:

```sh
bunx playwright show-report
```

Common setup failures:

- `File Workspace E2E helpers are disabled`: set `FILE_WORKSPACE_E2E_ENABLED=true`
  or `ALLOW_TEST_AUTH_ENDPOINTS=true` on the Convex deployment used by
  `VITE_CONVEX_URL`.
- `Missing required env var`: add the missing WorkOS or Convex E2E variable to
  `.env.local`.
- Auth storage state errors: remove `.auth/file-workspace-user.json` and rerun
  the focused suite so `e2e/file-workspace.setup.ts` recreates it.
- `/e2e/session` returns `{"disabled":true}`: the browser is pointed at a server
  that was not started with `VITE_E2E=true`; rerun with a fresh `E2E_PORT`.
