# Chunk Context: chunk-01-backend-review-api

## Goal
- Ship the backend review API for FairLend staff: queue filters, dossier projection, append-only reviewer notes, approve/request-changes/reject commands, and permission gates.

## Relevant plan excerpts
- "gate the initial broker review workspace and actions with the FairLend staff boundary plus explicit `onboarding:review`"
- "add broker-application-specific review commands that require note plus structured payloads instead of extending the narrow onboarding-request mutations directly"
- "add dedicated broker-application queue and dossier projections rather than stretching the old onboarding-request query"

## Implementation notes
- Existing broker-facing `queries.ts` and `mutations.ts` use `onboarding:access`; admin review exports should use `adminQuery` / `adminMutation` and `requirePermission("onboarding:review")`.
- Existing internal command functions already transition through `executeTransition`; keep them as the state-owner and expose thin public admin wrappers.
- Existing `appendBrokerNote` already writes `broker_note` entries into `brokerOnboardingReviewEntries`; the dossier should read the same thread.
- `approveApplication` currently has no reviewer-note input and emits only a system event; ENG-324 requires explicit reviewer reasoning for approve too.
- `requestChanges` trims to a default note and only implies reverification from field paths; ENG-324 requires non-empty reviewer note, reopened-field scope, and explicit reverification flags.

## Existing code touchpoints
- `convex/onboarding/brokerApplication/validators.ts`: add queue filter and review action validators.
- `convex/onboarding/brokerApplication/queries.ts`: add admin queue and dossier projections.
- `convex/onboarding/brokerApplication/mutations.ts`: add admin public review wrappers.
- `convex/onboarding/brokerApplication/internal.ts`: tighten command input validation and append typed reviewer entries.
- `docs/architecture/rbac-and-permissions.md`: verify the onboarding review/manage split remains aligned.

## GitNexus findings
- Worktree index refreshed on 2026-04-24 before edits.
- `buildBrokerOnboardingApplicationReadModel`: MEDIUM risk, five direct consumers in broker application query/mutation/internal modules.
- `approveApplication`, `requestChanges`, `rejectApplication`: LOW risk, no detected upstream callers before adding public wrappers.
- `canAccessAdminPath`: LOW risk, one direct caller in `src/routes/admin/route.tsx`.

## Validation
- `bun run test -- src/test/convex/onboarding/brokerReviewQueue.test.ts src/test/convex/onboarding/brokerReviewActions.test.ts`
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
