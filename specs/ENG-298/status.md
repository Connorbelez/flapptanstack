# Execution Status: ENG-298 - Broker portal: make WorkOS sign-in, callback, and logout host-aware

- Overall status: blocked
- Current phase: validation-and-audit
- Current chunk: chunk-04-validation-and-audit
- Last updated: 2026-04-20 17:13 EDT

## Active focus
- Close chunk `chunk-04-validation-and-audit`: persist the spec audit, document the remaining repo/tooling blockers, and leave the issue in an honest blocked state until the final gates can run cleanly.

## Blockers
- `bun check` still fails on existing Biome complexity diagnostics outside the ENG-298 diff, so the repo-wide quality gate is not green.
- `coderabbit review --plain` cannot produce a usable report for this detached/dirty worktree scope in the current session.

## Notes
- `ENG-297` host resolution and `users.homePortalId` groundwork already exist in code and should be consumed rather than recreated here.
- GitNexus marks `buildSignInRedirect` as `CRITICAL`, so the implementation will keep its call shape stable and shift host-aware behavior into additive auth-state and routing helpers.
- AuthKit callback redirects are same-origin via `returnPathname`, so cross-host portal routing must happen after callback completion in a post-auth route.
- `ready-to-edit` artifact validation passed on 2026-04-20 before code changes began.
- Chunk `chunk-01-auth-initiation` completed with focused auth tests and `bun typecheck` passing.
- Chunk `chunk-02-auth-completion` completed with focused route/backend auth tests and `bun typecheck` passing.
- Chunk `chunk-03-sign-out-and-e2e` completed with host-aware sign-out wiring, localhost/`*.localhost` E2E helper parameterization, targeted auth tests passing, `bun typecheck` passing, and `bunx convex codegen` passing.
- GitNexus `detect_changes` is not exposed in the current tool surface, so final scope reconciliation used `git diff --name-only HEAD` plus `git ls-files --others --exclude-standard`.
