# Admin Lawyers Management Design

## Status

Approved design sections, pending final user review of this written spec.

## Context

FairLend already has legal representation domain tables and helper modules:

- `lawyerProfiles` is the canonical profile anchor for platform, guest, and hybrid lawyer records.
- `lawyerVerifications` stores immutable eligibility and review evidence.
- `lawyerInvitations` stores deal-scoped invitations and delivery state.
- `representationEngagements` and `representationOverrideEvidence` store representation acceptance and admin override evidence.
- Platform lawyer assignment, availability, SLA, metrics, escalation, and restriction recheck tables already exist.

The admin shell currently has entities for deals, listings, properties, mortgages, obligations, borrowers, brokers, and lenders, but no `Lawyers` navigation item or dedicated lawyer operations surface. Deal detail screens can expose some selected-lawyer context, but administrators need a roster-first place to manage lawyer operations across deals.

## Goals

- Add `/admin/lawyers` and a `Lawyers` sidebar item under the System section.
- Make the default page a roster-first admin surface for all lawyer profiles.
- Include both platform and guest lawyer profiles in the roster.
- Keep guest lawyer creation deal-born only through deal invitation/replacement flows.
- Allow admins to invite or designate platform lawyers from this page.
- Include actionable deal-level lawyer work directly in the lawyer detail sheet.
- Make urgent lawyer work quick to filter, sort, and operate on.
- Bound the roster table height and paginate it so the page does not become an endless scroll.

## Non-Goals

- Do not create guest lawyer profiles directly from `/admin/lawyers`.
- Do not replace the existing deal detail page as the canonical deal operations surface.
- Do not add WorkOS roles named `platform_lawyer` or `guest_lawyer`; WorkOS remains canonical for the `lawyer` role, while `platform_lawyer` and `guest_lawyer` remain FairLend deal-scoped concepts.
- Do not rebuild the full CRM view engine for lawyers. The lawyers page can reuse admin shell pieces, but it needs a dedicated legal-operations projection.
- Do not implement LSO provider integrations beyond the existing verification/provider contracts unless a later implementation plan explicitly scopes that work.

## Architecture

`/admin/lawyers` should be a custom admin workspace backed by the existing legal representation tables, not just a generic CRM table view. It should still add `Lawyers` to the admin entity registry/navigation so it appears consistently in the sidebar, but the route should render a dedicated `AdminLawyersPage`.

The page should read from a purpose-built legal representation admin projection because a single lawyer row needs cross-table state from:

- `lawyerProfiles`
- `lawyerVerifications`
- `lawyerInvitations`
- `representationEngagements`
- `representationOverrideEvidence`
- `platformLawyerAssignments`
- `platformLawyerSlaReviews`
- `platformLawyerMetrics`
- `platformLawyerEscalations`
- `platformLawyerRestrictionRechecks`
- active `deals`

The main page has two layers:

1. Operational summary section: compact cards for urgent categories.
2. Paginated roster table: all lawyer profiles, filtered and sorted by operator intent.

The lawyer detail surface should use the existing admin detail-sheet/sidebar pattern where practical, but the content should be a dedicated lawyer detail component. Lawyer actions are legal-representation-specific and should not be squeezed into generic field rendering.

## Data And API Design

No new core lawyer tables are required for v1.

Add a dedicated Convex module at `convex/legalRepresentation/adminLawyers.ts` with admin-only functions.

### `listLawyerRosterPage`

Returns a cursor-paginated roster projection.

Inputs:

- search text
- profile kind filter: all, platform, guest, both
- platform status filter
- verification status filter
- urgency filter
- invitation status filter
- capacity/SLA filter
- sort key
- pagination cursor and page size

Output:

- page of roster rows
- continue cursor / pagination state
- capped count for the active filter base
- operational summary counts for the same filter base

Each roster row includes:

- lawyer profile id
- display name
- email
- firm name
- bar number and jurisdiction when available
- profile kind
- platform status
- latest verification summary
- active invitation summary
- active deal count
- capacity limit and warning
- SLA status
- restriction recheck status
- derived urgency bucket
- derived next action
- latest activity timestamp

The roster query should do server-side filtering and sorting. Page size should be bounded by the backend.

### `getLawyerAdminDetail`

Returns the full detail-sheet projection for one lawyer profile.

Includes:

- profile identity and kind
- latest verification plus recent verification history
- invitations, grouped by active/historical
- active and recent deals involving this lawyer
- representation engagements and override evidence
- platform assignment details
- availability/capacity/SLA/recheck/metrics summaries
- open escalations
- audit or activity signals sourced from existing audit/event records
- allowed actions for the current profile and related deal rows

### Platform Lawyer Invitation

Add `invitePlatformLawyer`.

Behavior:

- Email-first flow.
- Admin enters name, email, firm, and optional license basics.
- If a synced WorkOS user already exists for the email/auth identity, offer an attach/designate path.
- If no WorkOS user exists, create a pending platform profile and send a WorkOS invitation/onboarding invite.
- The resulting profile should be `platform` or `both` depending on whether an existing guest profile is being elevated.
- Active platform eligibility still requires WorkOS lawyer role evidence and verification gates.

### Deal-Level Lawyer Actions

Include these actions from the lawyer detail sheet:

- resend lawyer invitation
- cancel lawyer invitation
- replace deal lawyer
- verify representation with evidence
- override representation with evidence
- jump to deal

Resend, cancel, replace, and jump-to-deal should stay fast. Override/verify representation actions must require an explicit evidence note/reason.

Existing helpers in `platformLawyers.ts`, `profiles.ts`, `invitations.ts`, `management.ts`, `status.ts`, `verifications.ts`, and `gates.ts` should be reused rather than duplicating legal representation invariants.

## UX Design

The default `/admin/lawyers` screen is roster-first.

### Page Structure

- Page title and short subtitle.
- Operational summary section.
- Roster toolbar.
- Bounded, paginated roster table.
- Detail sheet opened by row click.

### Operational Summary Section

This section sits above the roster but should not dominate the page. It contains compact cards such as:

- Needs action
- SLA breached
- Invitations expiring
- Verification review
- At capacity
- Restriction recheck due

Clicking a card applies the corresponding roster filter and sort. Cards should show counts and short labels only.

### Roster Toolbar

The toolbar includes:

- Search
- Profile kind filter
- Platform status filter
- Urgency filter
- Verification filter
- Invitation filter
- Sort selector
- `Invite platform lawyer` action

Default ordering should prioritize urgent lawyer operations, then latest activity, then name.

### Roster Table

The table must be paginated and rendered inside a bounded-height region. The table body should have a maximum height with internal scrolling, while pagination controls remain visible and predictable.

Rows should be dense and scan-friendly:

- lawyer name, email, firm
- profile kind
- platform status
- verification status
- urgency / next action
- active deals
- capacity warning
- latest activity

Row click opens the lawyer detail sheet.

### Lawyer Detail Sheet

The detail sheet should include:

- Overview
- Operational Work
- Deals
- Verifications
- Invitations
- Platform Ops
- Audit / Activity

Operational actions should sit next to the row/item they affect rather than in one large action bar.

### Invite Platform Lawyer Dialog

The dialog starts with email-first entry. It then resolves whether a matching WorkOS user or existing lawyer profile exists.

Outcomes:

- Existing WorkOS user: show attach/designate confirmation.
- Existing guest lawyer profile: elevate to `both` after confirmation.
- New person: create pending platform profile and send WorkOS invitation/onboarding invite.

Guest profiles are not manually created here.

### Evidence Dialogs

Only verify/override representation actions require explicit reason/evidence text. The dialog should make the consequence clear and block submission until evidence text is present.

Routine resend/cancel/replace/status actions should not require evidence notes, though destructive actions may use normal confirmation dialogs.

## Urgency Model

The roster projection should derive urgency at read time in v1.

Suggested urgency order:

1. `sla_breached`
2. `representation_override_needed`
3. `verification_requires_review`
4. `invitation_expiring`
5. `restriction_recheck_due`
6. `at_capacity`
7. `pending_onboarding`
8. `normal`

Each row should expose both `urgency` and `nextAction` so the UI can sort and render clear operator prompts.

## Authorization And Audit

All admin lawyer functions must require FairLend admin access through existing admin function builders/middleware.

Evidence-required actions must write durable evidence/audit records:

- verify representation with evidence
- override representation with evidence

Status-changing platform operations should continue to use existing helpers that already enforce legal representation invariants. Where existing helper audit coverage is insufficient, add audit events in the implementation plan rather than bypassing helpers.

## Testing Plan

Backend tests:

- `listLawyerRosterPage` paginates and enforces page-size bounds.
- Quick filters return the expected urgent/status subsets.
- Sorts work for urgency, latest activity, capacity warning, verification expiry, and name.
- Guest profiles are listed but cannot be directly created from admin lawyers.
- Email-first platform invite creates a pending platform profile and invitation for a new person.
- Existing WorkOS user path attaches/designates instead of duplicating identity.
- Existing guest profile can be elevated to `both`.
- Override/verify representation actions reject missing evidence text.
- Admin auth boundaries reject non-admin callers.
- Evidence-required actions write override/audit evidence.

Frontend tests:

- Sidebar navigation includes `Lawyers`.
- Roster renders the operational summary section.
- Clicking summary cards filters/sorts the roster.
- Roster table uses pagination controls and a bounded-height scroll region.
- Row click opens the lawyer detail sheet.
- Detail sheet exposes deal-level actions.
- Evidence dialog blocks verify/override submission without evidence text.
- Invite platform lawyer dialog supports new-person and existing-user states.

Validation commands:

- `bun check`
- `bun typecheck`
- `bunx convex codegen`
- focused Convex legal representation/admin lawyer tests
- focused admin lawyer UI tests

## Implementation Notes

Implementation should be staged:

1. Backend projections and mutations.
2. Tests for projection, filters, sorting, invite flows, and evidence-required actions.
3. Admin navigation and route.
4. Roster UI with summary section, bounded table, and pagination.
5. Lawyer detail sheet.
6. Detail-sheet actions and evidence dialogs.
7. Focused browser verification.

The implementation plan should include GitNexus impact analysis before editing affected symbols, per repository instructions.
