# Execution Status: ENG-315 - Broker onboarding: lock verification-provider and auth contracts

- Overall status: complete
- Current phase: complete
- Current chunk: none
- Last updated: 2026-04-22T19:37:58Z

## Active focus
- ENG-315 is closed with the verification/auth contract freeze implemented, validated, and audited.

## Blockers
- none

## Notes
- Linear context was gathered from ENG-315, its synced comments, the linked implementation plan, the Governed Transitions ADR, and the Three-Way Identity Verification Gate page.
- The anticipated implementation is mostly additive. The current expected existing-file edits are concentrated in `convex/auth/permissionCatalog.ts`, `docs/architecture/rbac-and-permissions.md`, and auth test coverage.
- `convex/auth.ts` already registers `authentication.email_verification_succeeded`, but it is log-only today. The new email-verification contract should prefer existing auth claims and explicit helper contracts over widening the `Viewer` shape unless impact analysis proves that change is worth the blast radius.
- GitNexus MCP tools are not exposed in this session, so pre-edit impact work will use the local GitNexus CLI if it is available in the workspace.
- GitNexus impact results were acceptable: `lookupPermissions` is `MEDIUM` because role-matrix changes fan into auth fixtures and tests; raw permission metadata/role const nodes are effectively `LOW`, with real consumers concentrated in demo RBAC UI and permission tests.
- Implementation will stay additive where possible to avoid changing `lookupPermissions` or broad role-matrix semantics in this issue.
- The implementation surface is now on disk across shared contracts, verification providers/registry, permission catalog docs, and three focused test files.
- Final validation passed locally: targeted ENG-315 tests, `bunx convex codegen`, `bun check`, and `bun typecheck`.
- `bun check` still reports pre-existing cognitive-complexity warnings in unrelated files, but it exits successfully with no remaining errors after the incidental static-mockup CSS specificity fix.
