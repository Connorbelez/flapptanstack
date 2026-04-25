# Spec Audit: ENG-347 - Deal closing: ship lawyer workspace

- Audit skill: `$linear-pr-spec-audit`
- Review target: local branch diff for ENG-347 implementation
- Last run: 2026-04-24 19:10 EDT via `$linear-pr-spec-audit`
- Verdict: not ready

## Findings
- P1: Matter Overview still renders raw `fractionalShareUnits` as "Share units", which violates the ENG-347 requirement to avoid ambiguous `fractionalShare` values in the lawyer UI. Evidence: `src/components/lawyer/deals/LawyerDealWorkspacePage.tsx`.
- P1: Package approval backend checks document instance status for pending recipient resolution but does not inspect `signingState.status`, so a package surface with `signingState.status = "pending_recipient_resolution"` and a non-blocking instance status can still approve. Evidence: `convex/deals/lawyerMutations.ts`.
- P2: The timeline helper supports close milestones, but `getLawyerDealWorkspace` never supplies completed close milestones from close projections/status, so the workspace cannot satisfy the legal/signer/exception/close timeline requirement. Evidence: `convex/deals/lawyerQueries.ts` and `src/components/lawyer/deals/LawyerDealWorkspacePage.tsx`.
- P2: E2E remains unverified. The ENG-347 targeted browser spec exists, but Convex cannot deploy the seeder because existing dev data contains `portals.portalType = "mic"` outside the current schema; full `bun run test:e2e` also fails in existing shared auth/demo suites.

## Unresolved items
- Replace raw "Share units" display with the ENG-338 normalized percent/status copy or an explicit unavailable/blocker state.
- Extend package approval blockers to reject unresolved `signingState.status === "pending_recipient_resolution"` and add a backend test for that path.
- Add completed close milestones to the workspace timeline projection or explicitly document that close projection is unavailable and render a missing-contract blocker.
- Resolve the Convex dev data/schema mismatch and rerun the targeted ENG-347 E2E plus full `bun run test:e2e`.

## Next action
- Fix the three implementation gaps above, then migrate or admit the existing `portals.portalType = "mic"` dev data and rerun `bunx convex dev --once` plus `bun run test:e2e -- --project=deal-closing --no-deps e2e/deal-closing/lawyer-workspace.spec.ts`.
