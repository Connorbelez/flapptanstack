# Tasks: ENG-306 - Broker landing page: wire lender CTA and broker-attributed onboarding handoff

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Populate execution artifacts from Linear, Notion, and repo context.
- [x] T-002: Run ready-to-edit artifact validation.
- [x] T-003: Run GitNexus impact analysis for existing symbols planned for edits.

## Phase 2: Backend Handoff
- [x] T-010: Add a focused Convex lender landing handoff module that creates or resumes a `lenderOnboardings` record from active portal context.
- [x] T-011: Validate handoff inputs for entry path, optional listing id, and optional email without adding a broader schema contract.
- [x] T-012: Add Convex tests for broker attribution, subdomain attribution, resume behavior, listing entry paths, and fail-closed inactive portal cases.

## Phase 3: Route Wiring
- [x] T-020: Add a public `/start-lending` route outside auth-gated trees that resolves active root portal context, records the handoff, and redirects through host-aware sign-up with `/listings` as the safe return path.
- [x] T-021: Wire landing switchboard lender CTA, featured listing cards, and `View All` to canonical `/start-lending` URLs.
- [x] T-022: Preserve listing intent in the handoff URL for teaser-card clicks while keeping post-auth runtime on `/listings`.
- [x] T-023: Add or update route/component tests for the canonical handoff URLs and no demo path imports.

## Phase 4: Validation
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted Convex and route tests.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against ENG-306 and this branch diff.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Run final artifact validation with audit and all checklist/task closure required.
