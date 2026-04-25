# Execution Checklist: ENG-348 - Deal closing: ship buyer and seller workspaces

## Requirements From Linear
- [ ] Add a server-side participant deal queue projection returning only deals where the authenticated user has active scoped access or valid staff/portal access for the current persona.
- [ ] Group My Closings into Needs Action, In Progress, and Completed using server-projected lifecycle, signing task, blocker, and receipt state.
- [ ] Add buyer/seller workspace detail projection that composes ENG-338 participants/fraction/access, ENG-342 package/envelope/signing task state, ENG-343 participant-safe close receipt evidence, property/mortgage summary, assigned lawyer context, blockers, and timeline entries.
- [ ] Add buyer and seller route entry points with the authenticated `Authenticated` / `AuthLoading` wrapper before any suspense query screen renders.
- [ ] Reuse shared participant components for buyer and seller workspaces while keeping copy, labels, and next-action semantics role-specific.
- [ ] Render Overview, Documents & Signatures, Timeline, and Parties & Counsel panels for active and completed deals.
- [ ] Show embedded signing entry only when the server projection says the authenticated participant is the current active required recipient and provides a valid token/task.
- [ ] Show upcoming, blocked, expired-token, package-pending, package-failed, envelope-exception, and completed-artifact states without exposing unavailable files or other recipients' tokens.
- [ ] Show a read-only participant-safe completion receipt after close using ENG-343 evidence rather than `status === confirmed` alone.
- [ ] Preserve server-side authorization with `assertDealAccess` or an ENG-338 successor check in every query and mutation; do not rely on client filtering or raw buyer/seller identifiers.
- [ ] Preserve signable placeholder behavior: no PDF links for signable package members unless server artifact availability is explicit.
- [ ] Add focused Convex, component, route/integration, and e2e tests for happy paths, denial paths, revoked access, signing token visibility, exception states, and completed receipt.
- [ ] Keep all exported Convex functions on fluent builders with explicit `.public()` or `.internal()` visibility and avoid `any` unless isolated and justified.

## Definition Of Done From Linear
- [ ] Buyer and seller users can open My Closings and see only their authorized deal-scoped workspaces.
- [ ] My Closings groups deals into Needs Action, In Progress, and Completed using server-projected state.
- [ ] Each workspace renders Overview, Documents & Signatures, Timeline, and Parties & Counsel with role-specific task language and normalized participant/fraction values.
- [ ] Embedded signing appears only for a valid current-recipient task for the authenticated user and never exposes other recipients' tokens.
- [ ] Signable placeholders are not rendered as downloadable PDFs before server artifact availability exists.
- [ ] Completed deals show a participant-safe close receipt backed by ENG-343 evidence and remain read-only.
- [ ] Unauthorized, unrelated, revoked, failed, cancelled, package-failed, envelope-exception, token-expired, and no-active-closing states are handled explicitly and covered by tests.
- [ ] Buyer/seller route trees use the authenticated suspense wrapper pattern before child query screens render.
- [ ] Implementation follows the published Notion plan and keeps ENG-338, ENG-341, ENG-342, and ENG-343 contracts intact.
- [ ] The implementation worktree runs GitNexus impact before editing shared symbols and runs `bunx convex codegen`, `bun check`, `bun typecheck`, targeted participant query/route/component tests, `bun run test`, `bun run test:e2e`, and `bun run review` before completion.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [ ] Unit tests added or updated for Convex projection behavior, queue grouping, token visibility, receipt evidence, and placeholder visibility.
- [ ] Component and route tests added or updated for buyer/seller queue and workspace panels.
- [ ] E2E tests added or updated for participant happy path, unauthorized denial, and completed receipt.
- [ ] Storybook stories evaluated; not expected unless reusable participant components need isolated visual state coverage beyond tests.

## Final Validation
- [ ] All requirements are satisfied.
- [ ] All definition-of-done items are satisfied.
- [ ] Required quality gates passed.
- [ ] Test coverage expectations were met or explicitly justified.
- [ ] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
