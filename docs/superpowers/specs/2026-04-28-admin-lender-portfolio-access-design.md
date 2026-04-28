# Admin Lender Portfolio Access Design

## Goal

Admins need an interface to view and operate the exact lender portfolio for any lender, including the FairLend MIC lender, from the admin backoffice. The admin should see the same portfolio data and action surface that the lender sees, while every admin-performed action remains auditable as an admin acting for a target lender.

## Current Context

- Lenders currently access their portfolio through `src/routes/lender.portfolio.tsx`.
- The lender portfolio UI is implemented in `src/components/lender/portfolio/LenderPortfolioPage.tsx` and related components.
- Lender portfolio reads currently call `convex/portfolio/queries.ts`, which uses `portalLenderQuery()` to resolve the active lender and portal context.
- Portfolio assembly lives in `convex/portfolio/helpers.ts`, with supporting historical/export helpers in `convex/portfolio/history.ts` and `convex/portfolio/export.ts`.
- Admin backoffice records are exposed through the admin shell and entity routes under `src/routes/admin`.
- Lenders already exist as an admin entity at `/admin/lenders`.
- The FairLend MIC has a separate specialized MIC portfolio surface under `convex/micPortfolio`, but this feature should treat the MIC lender as a normal lender portfolio target.

## Decisions

- The admin entry point is a `Portfolio` tab on `/admin/lenders/:recordid`.
- The portfolio tab renders the existing lender portfolio experience, not a separate admin-specific portfolio approximation.
- Admins can use the full lender action surface from this tab.
- The target lender remains the business subject for reads and writes.
- Admin identity and route/source metadata are attached to every admin-performed action.
- MIC uses the same general lender portfolio tab. MIC-specific dashboard sections are not merged into this feature.
- A lender can only have one broker, so the admin portfolio context resolves the lender's single broker/portal context automatically and displays it.

## Recommended Architecture

Introduce a shared portfolio context adapter that makes the portfolio business subject explicit:

- `targetLender`
- `targetLenderId`
- `targetLenderAuthId`
- resolved broker/portal context
- viewer/admin metadata when present

Existing lender queries continue to resolve this context from `portalLenderQuery()`. New admin queries resolve the same context from `adminQuery` plus a `targetLenderId`. Both paths call the same portfolio builders and return the same Convex contracts.

This avoids route-level impersonation. The backend should never silently pretend the admin is the lender. Instead, admin access is an explicit backend access mode that is authorized through FairLend admin guards and then scoped to the selected lender.

## Backend Design

Add admin-only Convex portfolio functions under `convex/admin/portfolio/queries.ts` and related mutation modules:

- `listAdminLenderPortfolioTargets`
- `getAdminLenderPortfolioCommandCenter`
- `getAdminLenderPortfolioPositionDetail`
- `getAdminLenderPortfolioPaymentDetail`
- admin wrappers for each portfolio action exposed in the tab

The query functions should:

1. Use `adminQuery` or equivalent `requireFairLendAdmin` middleware.
2. Accept `targetLenderId`.
3. Load and validate the lender record.
4. Validate that the lender has an `authId`.
5. Resolve the lender's single broker/portal context.
6. Build the shared portfolio context.
7. Call the same portfolio builders used by lender portal queries.
8. Return the existing portfolio contracts unchanged.

The existing portfolio helper layer should be refactored so it does not depend directly on `ctx.viewer.authId` or `ctx.lender._id` as hidden globals. It should accept an explicit target-lender context. Current portal-scoped functions can build that context from the existing middleware and pass it through.

## UI Design

Add a `Portfolio` tab to the admin lender record page at `/admin/lenders/:recordid`.

The tab should render the existing `LenderPortfolioPage` with admin-specific query options. The embedded page should preserve:

- cockpit metrics
- positions table
- payment activity
- position and payment detail sheets
- action rail
- broker coordination
- suggested opportunities
- export strip
- empty states

The admin wrapper should add only the context required for backoffice safety:

- selected lender name
- resolved broker/portal context label
- MIC marker when the lender is the FairLend MIC lender
- visible copy that actions are audited under the current admin
- loading and error states specific to admin target resolution

No separate admin navigation item is required for the initial version because the chosen entry point is the lender record itself.

## Action And Audit Design

Admin-triggered portfolio actions should run as target-lender business actions with required admin metadata attached.

Each admin action wrapper should include:

- `targetLenderId`
- admin auth/user id from the authenticated viewer
- source route or feature id, such as `admin_lender_portfolio`
- target business record ids, such as mortgage id, obligation id, deal id, or renewal intent id
- timestamp
- reason when the action is consequential, user-visible, export-related, money-related, or status-changing

The business result should be the same result the lender action would have produced for that lender. Audit/event records must show that an admin initiated the action for the target lender.

Do not implement true impersonation. The action should not discard admin identity after resolving the target lender.

## Error Handling

The portfolio tab should fail closed for invalid admin target state.

Required admin-facing error states:

- lender record not found
- lender missing `authId`
- broker context missing
- portal/context resolution failed
- MIC lender mapping broken when the selected lender is expected to be the FairLend MIC
- target lender does not own the requested mortgage/payment detail
- current user is not a FairLend admin

Zero-position lenders should render the existing portfolio empty state rather than an error.

Business-rule errors from normal lender actions should be preserved. For example, if a renewal signal is no longer valid, the admin should see the same business reason the lender would see. Failed actions should not be recorded as successful audit events.

## MIC Handling

The FairLend MIC should appear as a normal lender target in `/admin/lenders`. Its `Portfolio` tab should use the same general lender portfolio contracts and UI as all other lenders.

The existing specialized MIC dashboard remains separate and is not part of this feature. This keeps the admin lender portfolio exact and prevents mixing two different portfolio products in one tab.

If MIC repair/setup is needed, the existing admin settings repair flow remains the owner. The portfolio tab should report the mapping problem instead of attempting repair.

## Testing Plan

Backend tests should cover:

- admin command-center query returns the same contract values as the lender's own portal-scoped command-center query for the same lender
- admin position detail query matches lender-owned detail behavior
- admin payment detail query matches lender-owned detail behavior
- FairLend MIC lender can be selected and rendered as a normal target lender
- zero-position target lender returns empty-state-safe portfolio data
- missing lender, missing `authId`, missing broker context, and invalid target ids fail closed
- non-admin callers are rejected
- admin action wrappers attach admin metadata while preserving target-lender business effects

Representative action tests should cover each action family exposed in the tab:

- renewal intent or renewal signal
- broker/message coordination when backed by mutations
- tax/export behavior
- deal/payment action if exposed from the existing portfolio page

Frontend tests should cover:

- Portfolio tab appears on admin lender detail pages
- tab uses admin portfolio query options rather than portal-scoped query options
- context banner displays target lender, broker/portal context, and audit notice
- zero-position state renders
- target-resolution errors render specific admin-facing states
- representative admin action sends target lender id and admin metadata

E2E coverage should include:

- admin opens `/admin/lenders/:recordid`
- admin switches to `Portfolio`
- exact portfolio content is visible
- one representative action completes
- resulting audit metadata is observable through the nearest available audit/event surface

Validation commands before completion:

```bash
bun check
bun typecheck
bunx convex codegen
```

## Out Of Scope

- Building a separate admin portfolio workspace.
- True user impersonation.
- Merging specialized MIC dashboard analytics into the lender portfolio tab.
- Changing lender-broker cardinality.
- Repairing MIC configuration from the portfolio tab.
- Redesigning the existing lender portfolio UI.
