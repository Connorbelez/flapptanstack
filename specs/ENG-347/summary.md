# Summary: ENG-347 - Deal closing: ship lawyer workspace

- Source issue: https://linear.app/fairlend/issue/ENG-347/deal-closing-ship-lawyer-workspace
- Primary plan: https://www.notion.so/34cfc1b44024811d8128efe0a15710f5
- Supporting docs:
  - https://www.notion.so/321fc1b440248127a3bef2ea0371aaf6
  - https://www.notion.so/317fc1b4402481a0964ded0ec547a9de
  - https://www.notion.so/313fc1b440248189a811ee4c5e551798
  - https://www.notion.so/34cfc1b440248146ad2cde40d49a8828
  - https://www.notion.so/34cfc1b44024819fa197fa2164623f46

## Scope
- Add `/lawyer` child routes for assigned closings and deal workspace.
- Add lawyer-facing UI for queue groups, Matter Overview, Package Review, Signers & Order, Timeline, action states, blockers, and read-only completion/access-ended states.
- Add pure view-model helpers for queue grouping, read-only policy, action eligibility, package blockers, signer summaries, and timeline normalization.
- Add lawyer-scoped Convex projections and mutations using `lawyerQuery` / `lawyerMutation`.
- Enforce lawyer authorization in Convex through active scoped `dealAccess` or explicit completed/read-only historical policy, never client filtering.
- Confirm representation through governed `REPRESENTATION_CONFIRMED`.
- Approve package through governed `LAWYER_APPROVED_DOCUMENTS` only after package/signatory/envelope preconditions pass.
- Consume ENG-338 participant/access/fraction projection and ENG-342 envelope attempt/exception projection.
- Add focused backend, component/route, and e2e coverage for authorized access, denied access, revoked access, valid actions, invalid state, package blockers, envelope exceptions, and reissue history.

## Constraints
- WorkOS AuthKit is identity source of truth; lawyer route/API gates must use existing auth middleware and route guard patterns.
- Authenticated suspense route trees must wrap child outlet with `Authenticated` / `AuthLoading` before child suspense queries render.
- `dealAccess.role` storage roles remain `lender`, `borrower`, `platform_lawyer`, and `guest_lawyer`; lawyer UI consumes normalized persona/access projections.
- `canAccessDeal` is broader than the lawyer product boundary and cannot be the only lawyer workspace authorization check.
- The Transition Engine is the only path that changes deal status; lawyer actions must not patch `deals.status`.
- Package approval must block missing generation, incomplete signatory mapping, and open pre-send exceptions.
- Signable placeholders are not live signing artifacts.
- Embedded signing tokens must not leak to lawyers unless the lawyer is the authenticated recipient.
- No admin controls, funds controls, or exception resolution controls in lawyer UI.
- If an upstream ENG-338 or ENG-342 contract is missing locally, render an explicit missing-contract blocker rather than duplicating that contract.

## GitNexus Impact Notes
- `assertDealAccess`: LOW risk, 4 direct callers (`dealPackages.ts`, `queries.ts`, `envelopes.ts`, transfer queries).
- `canAccessDeal`: LOW risk, 2 direct dependents (`canAccessTransferRequest`, `canAccessDocument`).
- `getPortalDealDetail`: LOW risk, no upstream callers in current index.
- `readDealDocumentPackageSurface`: LOW risk, 2 direct consumers (`deals/queries.ts`, `crm/detailContextQueries.ts`).
- `PackageSurface`: LOW risk, 2 direct consumers (`deals/queries.ts`, `crm/detailContextQueries.ts`).
- `transitionDeal`: LOW risk, no upstream callers in current index; admin UI references the generated API endpoint, so avoid changing its public contract.

## Open questions
- None block implementation. If local ENG-338/ENG-342 contracts are incomplete, keep blocker states visible and record any skipped live-envelope behavior in tests and audit notes.
