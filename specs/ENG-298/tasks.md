# Tasks: ENG-298 - Broker portal: make WorkOS sign-in, callback, and logout host-aware

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Scaffold `specs/ENG-298/` and populate execution artifacts from the Linear issue, implementation plan, and supporting docs.
- [x] T-002: Read the issue, linked Notion plan/docs, current auth/portal seams, and AuthKit callback surface to lock the implementation approach.
- [x] T-003: Run GitNexus analyze and pre-edit impact checks for the auth helper seams, recording `buildSignInRedirect` as `CRITICAL` and `handleWorkosSignOut` as `LOW`.

## Phase 2: Auth Initiation
- [x] T-010: Create `src/lib/portal/auth-state.ts` to sign, verify, and parse host-aware auth state with fail-closed tamper and stale-context handling.
- [x] T-011: Create `src/lib/portal/auth-routing.ts` to derive per-request WorkOS `redirectUri`, same-origin completion paths, and host-aware sign-out `returnTo` targets from `portalContext`.
- [x] T-012: Update `src/routes/sign-in.tsx` and `src/routes/sign-up.tsx` to issue host-aware WorkOS URLs without changing `buildSignInRedirect` call sites.

## Phase 3: Auth Completion
- [x] T-020: Add a post-auth completion surface and supporting data lookup to resolve `users.homePortalId`, validate same-portal access, and fail closed on missing or stale portal state.
- [x] T-021: Add wrong-portal rejection UI with a continue CTA to the assigned portal and explicit FairLend admin bypass handling.
- [x] T-022: Keep the WorkOS callback flow on supported AuthKit APIs by routing completion through same-origin `returnPathname` handling instead of callback internals.

## Phase 4: Sign-Out And Coverage
- [x] T-030: Thread host-aware `returnTo` through `src/lib/workos-sign-out.ts`, `src/routes/sign-out.tsx`, and `src/components/workos-user.tsx`.
- [x] T-031: Update localhost-focused auth route and helper coverage, including `e2e/helpers/workos-login.ts`, for marketing, FairLend app, and broker-host entry paths.
- [x] T-032: Record Storybook non-applicability for this auth/runtime slice unless the wrong-portal surface is extracted into a reusable documented component.
  `WrongPortalState` remains a route-owned runtime surface, so no Storybook story was added in this issue.

## Phase 5: Validation And Audit
- [ ] T-900: Run `bunx convex codegen`, `bun check`, `bun typecheck`, targeted auth route tests, relevant Convex tests, E2E coverage as applicable, and `coderabbit review --plain`.
- [x] T-910: Run `$linear-pr-spec-audit` against the current branch diff and persist the verdict in `specs/ENG-298/audit.md`.
- [ ] T-920: Resolve audit findings or record blockers, run GitNexus scope reconciliation, and close the execution checklist.
