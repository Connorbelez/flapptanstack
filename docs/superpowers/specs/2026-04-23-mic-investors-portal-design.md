# MIC Investors Portal Design

Date: 2026-04-23
Status: Draft approved in conversation, pending final spec review

## Goal

Build a read-only MIC Investors Portal at `mic.<domain>` that gives approved MIC investors real-time transparency into the MIC's portfolio and operations.

The public surface at `mic.<domain>` is accessible to anyone and acts as a landing page with:

- a sign-in CTA
- a `Request offering memorandum / prospectus` CTA with an email field

The authenticated surface at `mic.<domain>/portal` is invite-only and available only to approved MIC investors. In v1, all approved MIC investors see the same screen. There is no personalized cap-table or investor-specific holdings logic in scope.

## Product Decisions

### Confirmed decisions

- The MIC portal is a first-class portal in the existing portal registry.
- Admin approval is the access-grant event.
- The public `Request offering memorandum / prospectus` form is email-only and does not require immediate auth.
- Approval provisions access by creating or inviting the user into the dedicated MIC organization, granting the `micinvestor` role, and routing auth into the MIC portal.
- The MIC is modeled as another lender from the perspective of the mortgage ledger.
- MIC portfolio truth comes from mortgage-ledger participation, not org ownership over resources.
- The v1 dashboard is authenticated but not personalized.
- The v1 dashboard should show the maximum amount of information already available or directly derivable from the mortgage ledger.
- The v1 dashboard must not fabricate MIC treasury, cash-on-hand, or reserve reporting from incomplete cash-ledger coverage.
- Frontend-presentational work should be delegated to Kimi. Data wiring, auth, routing, backend logic, and validation remain Codex-owned.

### Explicitly out of scope

- MIC cap table
- personalized investor holdings or allocations
- MIC treasury accounting from the cash ledger
- bespoke document center beyond the public request CTA
- separate post-approval manual invite workflow
- org-ownership-based MIC portfolio inference

## Architecture

### Portal model

The MIC portal should be implemented as a normal portal record in the existing portal registry rather than as a host-specific special case.

Recommended MIC portal characteristics:

- host: `mic.<domain>`
- public landing path: `/`
- default post-auth path: `/portal`
- dedicated MIC organization backing membership access
- explicit mapping to the canonical MIC lender identity used in the mortgage ledger

This design reuses the existing host-aware portal resolution and post-auth routing model already present in the repo. It also avoids hardcoded exceptions that would need to be unwound later.

### Access model

The system should introduce a new WorkOS role:

- `micinvestor`

The system should also introduce a dedicated route permission:

- `mic:access`

`mic.<domain>/portal` should require:

- a valid portal host
- authentication
- `mic:access`

This keeps MIC access isolated from existing lender/broker/borrower islands instead of overloading `portfolio:view` as the only route boundary.

### Source of truth

The MIC portal reads portfolio truth from mortgage-ledger lender participation.

The MIC is treated as a lender identity in ledger space. MIC dashboard queries must derive holdings, metrics, and drilldown facts from that lender identity and related mortgage-ledger records.

The system must not:

- infer MIC holdings from WorkOS org ownership
- infer MIC holdings from portal organization membership
- synthesize treasury metrics from absent or incomplete cash-ledger coverage

## User Flows

### Public landing page flow

`mic.<domain>` is public and functions as the MIC landing page.

It should include:

- hero/value proposition
- sign-in CTA
- `Request offering memorandum / prospectus` CTA
- email input for the request CTA

When a visitor submits the form:

1. the system captures the email address
2. the system creates or reuses a pending MIC access request
3. the UI returns a generic success response without leaking internal request state

The public request flow should remain low-friction and should not require auth before approval.

### Approval and access grant flow

Admin approval is the access-grant event.

When an admin approves a MIC access request:

1. the system provisions or invites the user by email
2. the system adds the user to the dedicated MIC organization
3. the system grants the `micinvestor` role
4. the system ensures host-aware auth routing returns the user to the MIC portal

This keeps approval meaningful and avoids a second manual invite step.

### Authenticated portal flow

Approved users can authenticate and land on `mic.<domain>/portal`.

In v1:

- every approved MIC investor sees the same dashboard
- no user-specific holdings are shown
- the screen is strictly read-only

## Information Architecture

### Public surface

The public `mic.<domain>` landing page should contain:

- a hero with fund positioning and investor-facing copy
- a sign-in CTA
- an email capture CTA for requesting the offering memorandum or prospectus
- optional teaser transparency content only if it is safe and already supported by the system

### Authenticated portal surface

The authenticated route at `mic.<domain>/portal` should use a command-center style layout similar to the lender portfolio where useful, but it must use MIC-specific data contracts and labels.

Recommended page composition order:

1. Fund snapshot
2. Exception/focus rail
3. Positions table
4. Payments/history views
5. Exposure/concentration views

### Dashboard content

The dashboard should show as much useful information as the current mortgage-ledger model supports.

Recommended metric groups:

- outstanding principal
- active positions count
- weighted-average yield or coupon-style return measures where derivable
- weighted-average LTV
- maturity profile / maturity ladder
- delinquency or arrears exposure
- concentration by borrower
- concentration by geography
- concentration by property type
- concentration by mortgage status

The dashboard should favor transparency and direct derivations from current ledger truth over aspirational fund-accounting metrics the system does not yet support.

### Position drilldown

Each MIC-held position should be clickable.

Interaction pattern:

1. row click opens a right sidebar on desktop or drawer on mobile
2. sidebar shows a compact mortgage summary and recent status/payment context
3. sidebar includes a CTA to open a full mortgage detail page

The full mortgage detail page should display all relevant information already available in the system for that mortgage and its history.

Recommended full-detail content:

- mortgage summary
- borrower/property facts already available to the current system
- lifecycle/status timeline
- payment history
- maturity context
- position-level economics already represented in current contracts
- related operational history and derived facts already available from current read models

## Backend Design

### MIC access request entity

Do not overload the existing authenticated onboarding request flow for the public MIC access request path.

Instead, add a dedicated governed entity, for example:

- `micInvestorAccessRequest`

Reasoning:

- existing onboarding requests assume an authenticated user identity
- MIC request intake starts from a public email-only form
- MIC review/provisioning is a distinct product workflow
- a dedicated entity keeps semantics clean while still reusing governed transitions, auditability, and admin review patterns

Recommended fields:

- `email`
- `normalizedEmail`
- `portalId`
- `status`
- `requestedAt`
- `reviewedAt`
- `reviewedBy`
- `rejectionReason`
- `provisioningState`
- `provisioningError`
- `invitedUserWorkosId` or equivalent invite/provisioning metadata
- audit/journal references as needed by the existing transition/audit architecture

### Request lifecycle

Recommended lifecycle:

- `pending_review`
- `approved`
- `rejected`

Provisioning completion should be tracked separately from the review decision via explicit provisioning metadata such as `provisioningState`, `provisioningError`, and invite or membership identifiers. This preserves the product rule that admin approval is the access-grant event while still making incomplete provisioning visible to admins.

Behavior requirements:

- duplicate public submissions for the same email should be idempotent
- the public form should return a generic success response whether it created or reused a request
- if approval succeeds but provisioning fails, the request must remain visible as an explicit admin exception
- rejected email addresses may submit a new request later

### Portal-to-ledger mapping

The MIC portal needs explicit mapping to the lender identity used to derive MIC holdings from the mortgage ledger.

This can live either:

- directly on the MIC portal configuration, or
- in a MIC-specific configuration record referenced by the portal

The important requirement is not the exact storage shape. The important requirement is that MIC portfolio queries resolve a canonical MIC lender identity explicitly instead of reconstructing ownership from org relationships.

### Query contracts

Create separate MIC query contracts instead of directly reusing lender portfolio queries.

These MIC contracts can still:

- reuse shared aggregation helpers
- reuse shared presentational component seams
- reuse shared detail-host patterns

They should not:

- inherit lender-specific naming or assumptions where those semantics are no longer correct
- depend on org-scoped resource ownership

Recommended query surfaces:

- MIC dashboard snapshot query
- MIC positions list query
- MIC position detail query
- MIC payments/history query
- MIC concentration/exposure query

## Admin Dashboard

Add an admin surface for MIC access request triage.

Recommended capabilities:

- list/filter MIC access requests
- see pending requests by default
- approve request
- reject request with reason
- inspect request audit/history
- view provisioning status or exception state

This should be implemented as a dedicated admin section rather than buried implicitly inside unrelated onboarding views.

## Frontend Implementation Strategy

### Shared UI reuse

The MIC portal should reuse lender portfolio UI patterns where this materially reduces work and preserves consistency.

Good reuse candidates:

- command-center shell layout
- metric-card presentation patterns
- table/search/sort/filter affordances
- detail sidebar and mobile drawer host pattern
- full detail page shell structure

### Separate MIC contracts

Even with UI reuse, the MIC portal should have separate route and query seams so the fund-transparency experience is not treated as a relabeled lender account.

This means:

- dedicated MIC route(s)
- dedicated MIC data adapters/contracts
- MIC-specific search state where needed

### Frontend delegation boundary

Frontend-presentational work should be delegated to Kimi.

Delegate to Kimi:

- public MIC landing page presentation
- MIC portal page layout
- metric cards and dashboard composition
- positions table presentation
- detail sidebar shell
- responsive states
- loading, empty, and error visual states

Keep local to Codex:

- portal registry updates
- auth and permission enforcement
- request entity/workflow implementation
- admin triage queries/mutations
- mortgage-ledger-derived query logic
- routing integration
- tests
- final validation

## Error Handling

The MIC portal must fail closed.

Fail-closed scenarios include:

- missing or invalid MIC portal host
- authenticated user without `mic:access`
- missing or invalid MIC portal to lender mapping
- unresolved provisioning after approval

Expected outcomes:

- public landing page remains accessible
- protected routes show boundary/unauthorized states rather than partial data
- queries do not fall back to org ownership heuristics

## Testing Strategy

### Backend tests

Add tests for:

- public MIC access request creation
- duplicate request behavior
- approval and rejection transitions
- provisioning/invite effect behavior
- admin exception handling on provisioning failure
- audit/journal coverage
- MIC dashboard aggregation derived from mortgage-ledger lender participation

### Route/auth tests

Add tests for:

- public `mic.<domain>` landing access
- sign-in redirect to MIC host and `/portal`
- unauthorized authenticated user blocked from `/portal`
- approved MIC investor allowed into `/portal`
- wrong host / wrong portal boundary behavior

### UI tests

Add tests for:

- MIC landing page form states
- dashboard snapshot states
- positions table states
- row-click opens sidebar/drawer
- sidebar CTA opens full detail page
- MIC-specific empty/error states

### Reuse validation

Add focused tests proving:

- MIC contracts use mortgage-ledger lender participation as the source of truth
- MIC route behavior does not depend on org ownership
- reused lender UI primitives still behave correctly with MIC data shapes

## Delivery Sequence

Recommended delivery order:

1. add role/permission catalog support for `micinvestor` and `mic:access`
2. add MIC portal record/config and lender mapping support
3. implement `micInvestorAccessRequest` entity and public request flow
4. implement admin triage and provisioning/invite effects
5. implement MIC route/auth boundary
6. implement MIC query contracts from mortgage-ledger participation
7. implement MIC UI using shared portfolio primitives where appropriate
8. add tests across backend, route, and UI layers

## Open Constraints For Implementation

- The new WorkOS role `micinvestor` will be created in the WorkOS dashboard by the human.
- The implementation should assume that frontend-presentational work is delegated to Kimi rather than built directly in the main Codex flow.
- The design intentionally avoids introducing fund-accounting metrics that the current ledger model cannot support truthfully.

## Success Criteria

This design is successful when:

- `mic.<domain>` exists as a public MIC landing page
- the public CTA can create a pending MIC access request from email only
- admins can triage those requests in the dashboard
- approval provisions access into the dedicated MIC org with the `micinvestor` role
- approved users can authenticate into `mic.<domain>/portal`
- `mic.<domain>/portal` shows a shared, read-only, ledger-derived MIC transparency dashboard
- positions are clickable and drill into sidebar and full-detail mortgage views
- MIC portfolio truth is derived from mortgage-ledger lender participation, not org ownership
