# Execution Checklist: ENG-338 - Deal closing: normalize participant, access, and fraction contracts

## Requirements From Linear
- [x] Define shared TypeScript contracts for `DealPartyRole`, `DealAccessStorageRole`, `DealPortalPersona`, and `DealParticipantProjection`.
- [x] Keep `dealAccess.role` storage values as `lender`, `borrower`, `platform_lawyer`, and `guest_lawyer`; document the mapping to buyer/seller/lawyer/admin personas in code comments and tests.
- [x] Implement one shared server-side participant projection that resolves buyer, seller, lawyer, access role, user/domain IDs where available, display names, emails, active lawyer access, and unresolved/null fallback fields.
- [x] Expose `fractionalShareUnits` as the raw integer storage value and `fractionalShareDisplayPercent` as `units / 100`; stop downstream UI from rendering raw storage numbers as percentages.
- [x] Reject or explicitly surface invalid fractional share units outside `0..10000` in new mutation/projection paths; do not silently reinterpret invalid legacy values.
- [x] Ensure participant projection reads require FairLend staff admin authority or active server-side scoped deal access through shared Convex helpers.
- [x] Preserve `grantDealAccess` idempotency and active-row role-change behavior.
- [x] Preserve `dealAccess` revocation history; do not hard-delete access rows or destroy grant metadata.
- [x] Update existing portal/admin/document package query consumers to use the shared projection instead of deriving contact, persona, access, or fraction semantics locally.
- [x] Add backend and component tests for active access, revoked access denial, unresolved participants, missing lawyer info, platform/guest lawyer mapping, idempotent grants, and fraction display.
- [x] Keep all exported Convex functions on fluent builders with explicit `.public()` or `.internal()` visibility and avoid `any` unless isolated and justified.

## Definition Of Done From Linear
- [x] One canonical server-side participant/access/fraction projection exists and is covered by focused tests.
- [x] Buyer, seller, lawyer, admin, and storage-role semantics are explicit in code-level contracts and test names.
- [x] `fractionalShare` is no longer exposed to downstream UI as an ambiguous display field; downstream consumers receive units plus display percent.
- [x] `getPortalDealDetail` or its successor returns the normalized participant projection and remains server-authorized.
- [x] Deal document package reads and transfer reads continue to pass access tests after shared access/projection changes.
- [x] Revoked access cannot read participant projection data, and active scoped access can.
- [x] Duplicate grant calls do not create duplicate active access rows.
- [x] Missing optional lawyer or unresolved buyer/seller identities return explicit nullable/unresolved projection fields instead of crashing read-only screens.
- [x] Implementation follows the published Notion plan.
- [ ] `bunx convex codegen`, `bun check`, `bun typecheck`, targeted backend/component tests, `bun run test`, and `bun run review` pass before completion.
  - Blocked: `bun run test` and `bun run review` ran but failed on repo-wide blockers outside this diff.

## Acceptance Criteria From Plan
- [x] Lawyer verification provisions deal-scoped access.
- [x] The model supports platform and guest lawyers.
- [x] Deal reads require admin authority or active scoped access.
- [x] Cancellation revokes active deal access.
- [x] Close completion revokes lawyer access when the active legal role ends.
- [x] Access history is preserved for auditability.
- [x] Buyer and seller access semantics are explicit before participant portals ship.
- [x] The execution plan defines that `dealAccess.role` keeps `lender` / `borrower` storage role names.
- [x] Participant, lawyer, and admin reads enforce server-side authorization through shared Convex helpers.
- [x] Buyer/seller workspaces consume normalized participant identity and access projection rather than raw string identifiers.
- [x] Transition journal, idempotency, failed/cancelled deal retention, and auditability remain intact.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit and Convex tests added or updated for backend projection, validators, access helpers, grants, revocations, and business rules.
- [x] Component tests updated for user-facing fraction display changes.
- [x] E2E tests are not expected because this is a backend contract plus targeted existing surface update, unless route behavior expands.
- [x] Storybook stories are not expected because no reusable UI component or composed screen is introduced.

## Final Validation
- [x] All requirements are satisfied.
- [ ] All definition-of-done items are satisfied.
  - Blocked by final quality gate failures outside this diff.
- [ ] Required quality gates passed.
  - Blocked by `bun run test` and `bun run review`.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
