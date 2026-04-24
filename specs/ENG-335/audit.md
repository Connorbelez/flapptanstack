# Spec Audit: ENG-335 - Velocity package: add operator workflow integration and end-to-end coverage

- Audit skill: `$linear-pr-spec-audit`
- Review target: local branch diff for ENG-335
- Last run: 2026-04-24T20:07:15Z
- Verdict: ready

## Findings
- Resolved: Convex dev deployment now accepts the local functions/schema. Compatibility was added for existing dev `portals` rows with `portalType: "mic"` and `lenderId`, then `bunx convex dev --once` and `bunx convex codegen` succeeded.
- Resolved: Playwright activation failure remediation/retry is covered in `e2e/velocity/remediation.spec.ts` through the shared backend scenario plus `convex/test/velocityE2e.ts`.
- Resolved: Post-live drift is covered after successful activation. The e2e flow activates the package, mutates the mock Velocity deal, syncs, and asserts the live drift exception shown to operators.
- Resolved: Document upload/link and `Sync now` are covered through browser interactions. The happy path uploads PAD evidence through the workspace UI, mutates the mock Velocity deal, clicks `Sync now`, and asserts refreshed Velocity-owned data.

## Unresolved items
- None from the prior audit remain open.

## Next action
- Ready for human review. Validation evidence is recorded in `status.md`.
