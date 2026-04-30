# Tasks: ENG-322 - Broker onboarding: ship production self-serve wizard and branded preview

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize implementation task list and chunk plan from Linear, Notion, repo reads, and GitNexus impact analysis.
- [x] T-002: Validate execution artifacts at the `ready-to-edit` stage before implementation edits.

## Phase 2: Route Contracts
- [x] T-010: Replace `src/routes/onboard/route.tsx` hard auth gate with a public route shell.
- [x] T-011: Create `src/routes/onboard/index.tsx` route entry that branches between public intro, authenticated start/resume, wizard, status, corrections, approved, and activated states.
- [x] T-012: Add route-local referral helpers that sanitize and preserve referral context through auth redirect and `startOrResume`.
- [x] T-013: Add server-backed portal slug preview or availability query in `convex/portals/queries.ts` using shared portal contracts and registry lookups.
- [x] T-014: Add route-local view-model helpers for chapter progress, status mapping, correction metadata, submitted details, and portal teaser state.

## Phase 3: Broker-Facing Surfaces
- [x] T-020: Build `OnboardingIntro` with host-aware sign-in/sign-up entrypoints and referral preservation.
- [x] T-021: Build `OnboardingWizard` with server-backed draft save, IDV start, submit/resubmit, and chaptered progress.
- [x] T-022: Build `PortalTeaserCard` using shared normalization and server-backed availability feedback without implying slug claim.
- [x] T-023: Build `OnboardingStatusPage` for submitted, approved/provisioning, rejected, activated, and expired states.
- [x] T-024: Build `OnboardingCorrections` for `changes_requested` reopened fields, reviewer note, reverification flags, and resubmit.
- [x] T-025: Build `ReviewThreadComposer` for append-only `broker_note` entries and read-only thread display.

## Phase 4: Tests
- [x] T-100: Add route tests for public intro, WorkOS auth branching, referral preservation, and start/resume behavior.
- [x] T-110: Add status tests for submitted, changes-requested, approved, activated, rejected, and expired render paths.
- [x] T-120: Add portal teaser tests for normalization, reserved-word handling, host preview, and uniqueness feedback.
- [x] T-130: Add broker-note tests confirming the route calls `appendBrokerNote` and does not expose mutable CRM-note behavior.
- [x] T-140: Record e2e and Storybook rationale if they are not applicable to this route-local slice.

## Phase 5: Validation and Audit
- [x] T-900: Run targeted onboarding tests.
- [x] T-901: Run `bunx convex codegen`.
- [x] T-902: Run `bun check`.
- [x] T-903: Run `bun typecheck`.
- [x] T-910: Run `$linear-pr-spec-audit` for ENG-322 against the current branch diff.
- [x] T-920: Resolve audit findings or record blockers.
- [x] T-930: Validate execution artifacts at the final stage with all tasks and checklist items closed.
