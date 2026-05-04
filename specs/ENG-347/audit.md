# Spec Audit: ENG-347 - Deal closing: ship lawyer workspace

- Audit skill: `$linear-pr-spec-audit`
- Review target: local branch diff for ENG-347 implementation
- Last run: 2026-04-25 15:42 EDT after addressing follow-up review findings
- Verdict: implementation findings resolved; E2E remains blocked by existing dev data/schema mismatch

## Findings
- P2: E2E remains unverified. The ENG-347 targeted browser spec exists, but Convex cannot deploy the seeder because existing dev data contains `portals.portalType = "mic"` outside the current schema; full `bun run test:e2e` also fails in existing shared auth/demo suites.

## Resolved items
- Completed deals with active lawyer access now resolve to `completed_read_only` and remain non-writable.
- Lawyer query payloads no longer expose raw `fractionalShareUnits` at the matter, deal, or nested participant share-status levels.
- Matter Overview renders the ENG-338 normalized fractional share percent or validation/unavailable copy instead of raw storage units.
- Package approval blockers now reject both `dealDocumentInstances.status === "signature_pending_recipient_resolution"` and `signingState.status === "pending_recipient_resolution"`, with backend test coverage.
- Completed deals now project a close milestone into the workspace timeline, and the page passes it into `buildLawyerTimeline`.

## Unresolved items
- Resolve the Convex dev data/schema mismatch and rerun the targeted ENG-347 E2E plus full `bun run test:e2e`.

## Next action
- Migrate or admit the existing `portals.portalType = "mic"` dev data and rerun `bunx convex dev --once` plus `bun run test:e2e -- --project=deal-closing --no-deps e2e/deal-closing/lawyer-workspace.spec.ts`.
