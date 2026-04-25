# Tasks: ENG-307 - Broker landing page: add borrower and mortgage-applicant portal-attribution handoff

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning And Impact
- [x] T-001: Finalize implementation task list and chunk plan.
- [x] T-002: Run GitNexus index/status and impact checks for existing symbols expected to change, recording any blind spots.
  GitNexus index is up to date for `/Users/connor/.codex/worktrees/da0e/fairlendapp` at commit `31d8ff1`. Impact lookups for `PortalLandingPage`, `PortalLandingFinancingStrip`, `PortalLandingSwitchboard`, `buildSwitchboard`, `buildFinancingStrip`, and touched file paths did not resolve by target name in the CLI index. No HIGH or CRITICAL impact result was returned. Fallback impact review uses direct imports/callers: portal root route imports `PortalLandingPage`; landing component consumes `PublicPortalLandingPageContract`; Convex `getPublicPortalLandingPage` builds the action contract; tests cover the route/component boundary.
- [x] T-003: Validate execution artifacts at the `ready-to-edit` stage.

## Phase 2: Contracts And Routes
- [x] T-010: Add production public financing continuation routes outside `/borrower`: `/financing/start` and `/financing/pre-approval`.
  Implemented `src/routes/financing.start.tsx`, `src/routes/financing.pre-approval.tsx`, and `PortalFinancingStartPage`.
- [x] T-011: Define and parse the minimal prefill/resume contract for `fullName`, `email`, and `amountNeeded` on the continuation routes.
  Both routes parse only non-empty string search params and pass them as lightweight display/auth-return prefill.
- [x] T-012: Preserve resolved portal context on the continuation screens and fail closed when the root portal boundary marks the host unavailable.
  `/financing` is registered as a portal-only route policy and each route asserts an active portal id before rendering.
- [x] T-013: Add or reuse a thin backend continuation seam only if the route needs to create or resume provisional application state in this slice.
  No backend create/resume seam was added because anonymous landing traffic should not create provisional rows before identity. The screen preserves portal attribution and sends users through host-aware auth with a redirect back to the same financing route and prefill.

## Phase 3: Landing Handoff UI
- [x] T-020: Wire landing borrower primary and nested pre-approval actions to the production financing route family through the landing contract.
  The existing landing contract defaults borrower primary action to `/financing/start` and nested pre-approval to `/financing/pre-approval`; route tests now lock this behavior.
- [x] T-021: Wire the inline financing strip submit behavior to the same route family with only lightweight query prefill.
  The landing strip posts to `/financing/start` with `fullName`, `email`, and `amountNeeded` only.
- [x] T-022: Keep the landing renderer short and free of full application form state, demo mortgage-application imports, and mocked Zustand flows.
  The landing renderer remains a path-selection surface; production continuation state lives in the financing route component and no demo mortgage app/Zustand code is imported.

## Phase 4: Tests And Validation
- [x] T-030: Add or update route/component tests for borrower CTA, nested pre-approval CTA, inline strip handoff, and prefill rendering.
  Added `portal-financing-continuation` tests and expanded portal home/host policy tests.
- [x] T-031: Add backend tests if backend create/resume code changes; otherwise document why backend tests are not applicable.
  No backend create/resume code changed; backend tests are not applicable for this UI route handoff slice.
- [x] T-032: Add E2E coverage for the public landing-to-financing workflow or document why route-level coverage is sufficient for this slice.
  Route/component coverage is sufficient here because the changed contract is public link/form routing plus prefill rendering; no browser-only behavior or backend workflow was introduced.
- [x] T-033: Add Storybook stories for changed reusable UI states or document why no reusable component story is needed.
  No Storybook story was added because the new component is route-owned, not a reusable design-system primitive.
- [x] T-900: Run final quality gates: `bunx convex codegen`, `bun check`, `bun typecheck`, and targeted tests.
  All listed gates passed. Full `bun run test` was also attempted and failed on unrelated pre-existing suites; details are recorded in status and audit.
- [x] T-910: Run `$linear-pr-spec-audit` against ENG-307 and the current branch diff.
  Audit completed with a `needs manual validation` verdict because the full suite has unrelated failures outside this branch.
- [x] T-920: Resolve audit findings or record explicit blockers, then rerun artifact validation at the final stage.
  No ENG-307 blocking audit findings remain; final artifact validation is tracked in status.
