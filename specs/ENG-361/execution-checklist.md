# Execution Checklist: ENG-361 - Legal representation: manage platform lawyer profiles and eligibility

## Requirements From Linear
- [x] Add admin-gated mutations for creating/designating, activating, suspending, and offboarding platform lawyer profiles.
- [x] Require canonical WorkOS role/permission semantics: the profile authId must refer to a user who signs in as `lawyer`; do not add platform_lawyer as a WorkOS role.
- [x] Store platform-vs-guest distinction in lawyerProfiles/profileKind and dealAccess role only.
- [x] A platform lawyer is selectable for new deals only when platformStatus is active and latest eligibility helper allows selection.
- [x] Suspended or offboarded platform lawyers remain visible to admins for audit but are not selectable for new deals.
- [x] Existing deals and lawyer workspace access remain compatible with `dealAccess.role = "platform_lawyer"` and deals.lawyerId WorkOS auth ID.
- [x] Add audit entries or equivalent evidence rows for platform profile status changes.
- [x] Provide a deterministic seed/admin path for at least two active lawyers, one suspended lawyer, and one requires-review lawyer.

## Definition Of Done From Linear
- [x] Platform lawyer profiles are managed in FairLend domain data, not WorkOS role proliferation.
- [x] Only active eligible platform lawyers can be selected for new deals.
- [x] Admin profile status changes are auditable.
- [x] Existing platform lawyer dealAccess and lawyer workspace behavior remain intact.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated where backend or domain logic changed.
- [x] E2E tests added or updated where an operator or user workflow changed, or explicitly justified as not applicable.
  - No E2E added: this slice changed backend/admin APIs and data sourcing only, with existing checkout component tests covering the UI payload path.
- [x] Storybook stories added or updated where reusable UI changed, or explicitly justified as not applicable.
  - No Storybook added: no reusable component or visual state was introduced.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
