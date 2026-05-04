# Spec Audit: ENG-348 - Deal closing: ship buyer and seller workspaces

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch/worktree diff from repo root
- Last run: 2026-04-25
- Verdict: not ready

## Findings
- P1: E2E acceptance coverage is incomplete and not passing. Current participant e2e checks route headings and opens a buyer workspace, but does not prove buyer/seller participant identities, unauthorized denial, completed receipt, or signing completion paths.
- P1: Final validation is incomplete. `bun run test` still fails in unrelated AMPS demo tests, focused participant e2e is blocked by the dev Convex deployment schema/data issue, and final review/audit closure tasks remain open.
- P1: Receipt evidence handling must be tightened so blocked or failed signed archive rows cannot mark a confirmed deal completed.
- P2: Embedded signing entry contract is unverified. The UI treats `embeddedSigningToken` as an href, but backend/test data indicates it may be an opaque token.
- P2: Participant e2e setup authenticates as admin, so it bypasses the buyer/seller persona RBAC path it is meant to validate.
- P2: Edge coverage remains partial for cancelled/failed deal historical state, unauthorized e2e denial, no-active-closing e2e, and completed receipt e2e.
- P3: Untracked review output under `reviews/HEAD/e8398bfd6.md` should not be committed.

## Unresolved items
- Coverage summary: SATISFIED 8, PARTIAL 5, MISSING 0, CONTRADICTED 0, UNVERIFIED 1.
- `T-213`, `T-904`, `T-905`, `T-906`, `T-920`, and `T-930` remain open.
- Dev Convex deploy is blocked by existing `portals.portalType = "mic"` data that violates the checked-in `fairlend | broker` schema.
- Full Vitest suite is blocked by unrelated `convex/demo/__tests__/ampsE2e.test.ts` failures.

## Next action
- Fix receipt evidence completion logic.
- Verify the Documenso embedded token-to-signing-entry contract and change the UI/backend projection to use a provider-safe signing URL or app signing route if tokens are opaque.
- Replace admin-only participant e2e with seeded buyer, seller, unauthorized, and completed receipt scenarios.
- Resolve or explicitly waive the dev deployment data blocker and unrelated AMPS full-suite failures.
- Remove or ignore transient `reviews/` output before packaging the PR.
