# Execution Checklist: ENG-347 - Deal closing: ship lawyer workspace

## Requirements From Linear
- [ ] The lawyer parent route must use the authenticated layout wrapper from `src/routes/listings/route.tsx` before any suspense query child screen renders.
- [ ] Lawyer assigned closings must list only deals visible to the authenticated lawyer through active scoped lawyer access or a valid platform lawyer assignment; authorization must be enforced in Convex, not through client filtering.
- [ ] The assigned closings entry point must group matters into Needs Representation Confirmation, Needs Package Review, Awaiting Signers, and Completed using server-projected state.
- [ ] A lawyer deal workspace route must deny unauthorized users, non-lawyers, unrelated lawyers, and revoked-active access server-side.
- [ ] The workspace must include Matter Overview, Package Review, Signers & Order, and Timeline panels backed by server projections.
- [ ] Matter Overview must consume ENG-338 participant/access/fraction fields and must not render raw buyer/seller auth strings or ambiguous `fractionalShare` values.
- [ ] Package Review must consume package surface data and ENG-342 envelope/pre-send exception data; signable placeholders must not be treated as live signing artifacts.
- [ ] Representation confirmation must be exposed only for active authorized lawyers in valid lifecycle state and must emit `REPRESENTATION_CONFIRMED` through governed transition execution.
- [ ] Package approval must be exposed only for active authorized lawyers in valid lifecycle state and must emit `LAWYER_APPROVED_DOCUMENTS` only after package generation exists, signatory mappings are complete, and pre-send exceptions are absent.
- [ ] Signers & Order must consume ENG-342 recipient roster/order/progress/reissue state and must not create a persona-local signing model.
- [ ] Timeline must display legal actions, signer progress, document exceptions, and completed close milestones from audit/envelope/close projections without giving lawyers admin controls.
- [ ] Completed or ended-role views must be read-only; active action buttons must disappear or be disabled with explicit reasons.
- [ ] Backend tests must cover authorized active lawyer access, unauthorized denial, revoked access denial or read-only completion behavior, valid representation confirmation, invalid-state rejection, valid package approval, and precondition failure rejection.
- [ ] Route/component/e2e tests must cover queue grouping, workspace panels, action disable/error states, access revocation while open, package failure, envelope exception, and reissue history.
- [ ] Implementation must follow the published Notion plan: https://www.notion.so/34cfc1b44024811d8128efe0a15710f5.

## Definition Of Done From Linear
- [ ] `/lawyer` uses the authenticated parent-layout pattern and exposes an assigned closings entry route plus a deal workspace route.
- [ ] Lawyers see only authorized scoped matters and cannot enumerate or open unrelated deals.
- [ ] Assigned closings are grouped into Needs Representation Confirmation, Needs Package Review, Awaiting Signers, and Completed.
- [ ] The workspace renders Matter Overview, Package Review, Signers & Order, and Timeline without crashing on missing optional data.
- [ ] Representation confirmation is governed, access-checked, and state-checked; invalid or unauthorized attempts are rejected and covered by tests.
- [ ] Package approval is governed, access-checked, state-checked, and blocked by missing package, incomplete signatory mapping, or open pre-send exception.
- [ ] Package, signer, exception, and reissue displays consume ENG-342-compatible projection contracts rather than local lawyer-only state.
- [ ] Participant, lawyer, access, and fraction display consume ENG-338-compatible projection contracts.
- [ ] Completed/ended-role lawyer states are read-only and do not expose admin, funds, or financial operator controls.
- [ ] Revoked active access is handled explicitly according to the read-only completion policy and tested.
- [ ] Focused Convex, component, route, and e2e tests cover happy paths, rejection paths, and key edge states.
- [ ] Implementation follows the published Notion plan: https://www.notion.so/34cfc1b44024811d8128efe0a15710f5.
- [ ] `bunx convex codegen`, `bun check`, `bun typecheck`, targeted lawyer query/mutation/route tests, `bun run test`, `bun run test:e2e`, and `bun run review` pass before implementation is considered complete.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [ ] Unit tests added or updated for lawyer view-model helpers and backend projection/action preconditions.
- [ ] Convex tests added for active lawyer access, unauthorized denial, revoked access/read-only behavior, representation confirmation, package approval, and package/envelope blocker rejection.
- [ ] Route/component tests added for queue grouping, workspace panels, action disabled/error states, package failure, envelope exception, and reissue history.
- [ ] E2E tests added or updated for a seeded lawyer queue/workspace/action flow and access revocation behavior.
- [ ] Storybook coverage is added if new reusable lawyer UI components are structured for Storybook; otherwise record why route-level tests are the appropriate coverage.

## Final Validation
- [ ] All requirements are satisfied.
- [ ] All definition-of-done items are satisfied.
- [ ] Required quality gates passed.
- [ ] Test coverage expectations were met or explicitly justified.
- [ ] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
