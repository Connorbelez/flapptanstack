# Chunk Context: chunk-01-route-contracts

## Goal
- Replace the protected `/onboard` placeholder with a public route shell, route entry, referral context helpers, server-backed slug preview, and view-model mapping.

## Relevant plan excerpts
- "Welcome and value-prop come before auth friction, but real data entry starts only after WorkOS authentication."
- "Render current step and status from `brokerOnboardingApplication` rather than from local-only component state."
- "Reuse shared portal slug and host contracts for normalization, reserved-word handling, host preview, and uniqueness feedback."

## Implementation notes
- `src/routes/onboard/route.tsx` currently uses `guardRouteAccess("onboarding")` and only renders `<Outlet />`.
- `api.onboarding.brokerApplication.queries.getCurrent` returns the current server-owned read model or `null`.
- `api.onboarding.brokerApplication.mutations.startOrResume` accepts `referralSource`, `invitedByBrokerId`, and optional `portalId`.
- `shared/portal/contracts.ts` owns `normalizePortalSlug`, `isReservedPortalSlug`, and `buildPortalHosts`.
- Add slug availability as a narrow server query in `convex/portals/queries.ts`; do not duplicate uniqueness logic in the client.

## Existing code touchpoints
- `src/routes/onboard/route.tsx:Route`: GitNexus context found no incoming/outgoing refs; LOW risk.
- `convex/onboarding/brokerApplication/queries.ts:getCurrent`: LOW impact.
- `convex/portals/queries.ts:resolvePortalByHost`: LOW impact; adding a sibling query is preferred over changing this function.
- `convex/onboarding/brokerApplication/helpers.ts:buildBrokerOnboardingApplicationReadModel`: MEDIUM impact; avoid changing.

## Validation
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-322 --repo-root "/Users/connor/.codex/worktrees/c31f/fairlendapp" --stage ready-to-edit`
- Targeted tests from chunk 03 after implementation.
