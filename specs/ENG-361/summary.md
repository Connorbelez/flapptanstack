# Summary: ENG-361 - Legal representation: manage platform lawyer profiles and eligibility

- Source issue: https://linear.app/fairlend/issue/ENG-361/legal-representation-manage-platform-lawyer-profiles-and-eligibility
- Primary plan: https://www.notion.so/350fc1b4402481609d93df3edf40182b
- Supporting docs:
  - https://www.notion.so/313fc1b44024812691b3fa077308a1af
  - docs/architecture/rbac-and-permissions.md

## Scope
- Add FairLend-domain platform lawyer management on top of canonical WorkOS `lawyer` identities.
- Create admin-gated Convex APIs for create/designate, update, activate, suspend, offboard, list, eligibility projection, checkout options, and deterministic seed data.
- Connect marketplace checkout lawyer options to active eligible platform lawyer profiles.
- Add backend and checkout regression tests.

## Constraints
- Do not add WorkOS roles named `platform_lawyer` or `guest_lawyer`; WorkOS remains canonical with role `lawyer`.
- Platform/guest distinction lives in `lawyerProfiles.profileKind` and `dealAccess.role`.
- Admin mutations must use `requireFairLendAdmin`-equivalent fluent-convex authorization.
- Suspended, offboarded, restricted, stale, or review-required platform lawyers must not be selectable for new deals.
- Existing `dealAccess.role = "platform_lawyer"` and `deals.lawyerId` WorkOS auth ID behavior must remain compatible.
- Do not hard-delete platform lawyer profiles; status changes preserve auditability.

## Open questions
- Admin UI is not explicitly required for this issue. The implementation will ship backend/admin seed APIs and checkout source wiring unless scope expands.
