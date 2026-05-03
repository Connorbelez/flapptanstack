# Broker Onboarding Review Findings Design

## Summary

The Broker Onboarding Linear project has substantial backend foundation in place, but three review findings block the project from being considered complete:

- `/onboard` is still only a guarded layout route.
- Reviewer approval does not require explicit reviewer reasoning.
- Request-changes actions can be vague because blank notes and empty reopened-field payloads are accepted.

This spec closes those gaps as one coherent slice. The production broker onboarding route becomes a real server-backed flow, while the admin review workflow gets strict command contracts that require reviewer reasoning and structured correction scope. The backend remains the source of truth for lifecycle, verification, review history, and downstream provisioning.

## Goals

- Replace the production `/onboard` placeholder with a real broker self-serve onboarding experience.
- Render broker onboarding UI from `brokerOnboardingApplications` server state, not a local-only wizard state machine.
- Provide first-class screens for draft, submitted, changes requested, approved, activated, rejected, and expired states.
- Require explicit reviewer reasoning for approve, request-changes, and reject actions.
- Require request-changes payloads to identify reopened fields or sections and reverification requirements.
- Expose admin-facing broker review commands behind FairLend staff boundaries plus onboarding review permissions.
- Keep broker notes and reviewer notes in the dedicated append-only `brokerOnboardingReviewEntries` thread.
- Preserve the existing downstream `onboardingRequest` provisioning seam.

## Non-Goals

- Rebuild verification provider contracts, FSRA import, IDV callbacks, or broker activation. Those foundations already exist.
- Replace the existing governed transition engine.
- Add a full public marketing site for broker onboarding.
- Build a generic onboarding framework for lender, borrower, lawyer, and broker flows.
- Reuse demo-only broker white-label local store state as production persistence.
- Reuse generic CRM notes or `RecordNotesPanel` as the broker onboarding review thread.

## Current Context

Production route:

- `src/routes/onboard/route.tsx` currently calls `guardRouteAccess("onboarding")` and renders only `<Outlet />`.
- `src/routeTree.gen.ts` registers `/onboard`, but no production child route or index route is present.
- Demo onboarding routes exist under `/demo/rbac-auth/onboarding` and `/demo/broker-whitelabel/onboarding`, but they do not satisfy the production broker onboarding route requirement.

Broker application backend:

- `convex/schema.ts` defines `brokerOnboardingApplications`, `brokerOnboardingReviewEntries`, verification callback events, and FSRA import tables.
- `convex/onboarding/brokerApplication/mutations.ts` exposes broker-facing start/resume, save draft, append broker note, and submit mutations behind `onboarding:access`.
- `convex/onboarding/brokerApplication/queries.ts` exposes `getCurrent` for the signed-in broker applicant.
- `convex/onboarding/brokerApplication/internal.ts` contains internal review and lifecycle helpers including `requestChanges`, `approveApplication`, and `rejectApplication`.
- `convex/brokers/activation.ts` and `convex/brokers/resolveOrProvision.ts` implement canonical broker activation and portal provisioning.

Review gaps:

- `approveApplication` accepts no reviewer note and writes a canned system event.
- `requestChanges` allows `body.trim()` to be blank and replaces it with `"Changes requested."`.
- `requestChanges` accepts an empty `reopenedFields` array.
- The review actions are internal helpers, not explicit admin-facing commands guarded by staff/admin plus `onboarding:review`.
- No production admin queue/dossier route was found for broker onboarding review.

## Architecture

Add two coordinated surfaces on top of the existing aggregate.

Broker-facing production route:

- `/onboard` becomes an authenticated index route that renders a production `BrokerOnboardingPage`.
- The page calls `api.onboarding.brokerApplication.queries.getCurrent`.
- If no application exists, it starts one through `api.onboarding.brokerApplication.mutations.startOrResume`.
- All steps save through `saveDraft` and submit through `submit`.
- Submitted, changes-requested, approved, activated, rejected, and expired states render from the returned application read model.
- Broker notes append through `appendBrokerNote`.

Admin-facing review surface:

- Add public admin broker onboarding review query and mutation functions that wrap the existing internal helpers.
- The public review commands enforce:
  - FairLend staff boundary.
  - `onboarding:review` for reviewer decisions.
  - explicit non-empty reviewer notes for approve/request-changes/reject.
  - non-empty structured reopened fields or sections for request changes.
- Queue and dossier read models are normalized server projections. Components do not parse raw IDV, FSRA, or vendor payloads.
- Internal helpers remain reusable, but their input contracts become strict enough that tests cannot accidentally exercise invalid review behavior.

## Route And UI Design

### Broker Route

The production route tree should contain:

- `src/routes/onboard/route.tsx`
  - keeps the route-level `guardRouteAccess("onboarding")`.
  - renders `Outlet`.
- `src/routes/onboard/index.tsx`
  - renders the production broker onboarding page.

Recommended component split:

- `src/components/onboarding/broker/BrokerOnboardingPage.tsx`
  - orchestrates query/mutation calls and top-level state selection.
- `src/components/onboarding/broker/BrokerOnboardingWizard.tsx`
  - renders editable draft and changes-requested steps.
- `src/components/onboarding/broker/BrokerOnboardingStatusPage.tsx`
  - renders submitted, approved, activated, rejected, and expired states.
- `src/components/onboarding/broker/BrokerOnboardingCorrectionPanel.tsx`
  - renders only open `reopenedFields` and reverification requirements.
- `src/components/onboarding/broker/BrokerPortalPreview.tsx`
  - previews the requested portal slug/host through shared portal helpers.
- `src/components/onboarding/broker/BrokerReviewThread.tsx`
  - renders append-only reviewer, broker, and system entries.

### Broker UX States

No current application:

- Start/resume the application from the server.
- Show a short intro and immediately enter the draft wizard once the read model is available.

Draft:

- Show chaptered progress.
- Capture self-reported name, license number, license province, brokerage information, requested portal slug, and portal branding fields supported by the existing draft schema.
- Show a portal preview before the verification-heavy step.
- Save draft through `saveDraft`.
- Submit through `submit`.

Submitted:

- Show submitted details, verification status summary, reviewer expectations, portal preview, and review thread.
- Allow a short broker note through `appendBrokerNote`.
- Do not allow draft edits unless the status changes to `changes_requested`.

Changes requested:

- Show reviewer note and open reopened fields.
- Show reverification requirements from `verificationState.requiresReverification` and `verificationState.reverificationFieldPaths`.
- Allow edits only for the reopened fields or their containing sections.
- Submit resolves open fields through the existing resubmission behavior.

Approved:

- Show that the broker application was approved but downstream provisioning may still be in progress.
- Show downstream handoff status from `downstreamHandoffStatus`.
- Do not present the broker as activated unless `status === "activated"`.

Activated:

- Show the broker portal activation outcome, home portal assignment, and route to the broker workspace or portal home.

Rejected:

- Show rejection reason from the review thread and final status.
- Do not allow broker notes or resubmission unless a future explicit reopen command exists.

Expired:

- Show that the 30-day resume window expired.
- Offer to start a new application through `startOrResume`, which already expires stale candidates before creating a new draft.

## Admin Review Design

### Admin Routes

Add a production admin review route:

- `src/routes/admin/broker-onboarding.tsx`

The route must use an admin authorization pattern consistent with other admin routes. It must not rely on broker-facing `onboarding:access`.

Recommended components:

- `src/components/admin/broker-onboarding/BrokerOnboardingReviewPage.tsx`
- `src/components/admin/broker-onboarding/BrokerOnboardingQueue.tsx`
- `src/components/admin/broker-onboarding/BrokerOnboardingDossier.tsx`
- `src/components/admin/broker-onboarding/BrokerOnboardingReviewActions.tsx`
- `src/components/admin/broker-onboarding/BrokerOnboardingEvidenceSummary.tsx`
- `src/components/admin/broker-onboarding/BrokerOnboardingReviewThread.tsx`

### Queue Views

The queue supports:

- Submitted
- Changes Requested
- Recently Updated
- Rejected

Each row includes:

- applicant name or email
- status
- verification recommendation
- reason codes
- stale/reverification indicators
- last activity time
- submitted/changes-requested/rejected timestamps when present
- downstream handoff status for approved records

### Dossier

The dossier includes:

- self-reported applicant details
- requested portal slug and preview
- brokerage and license information
- normalized regulator result
- normalized IDV result
- WorkOS email verification state
- recommendation and reason codes
- evidence references
- review thread
- downstream handoff status and activation outcome when present

The dossier must not recompute verification policy in React. It renders server-provided normalized state.

## Backend API Design

### Public Admin Review Queries

Add `convex/onboarding/brokerApplication/reviewQueries.ts`.

Functions:

- `listReviewQueue`
  - visibility: `.public()`
  - auth: FairLend staff boundary plus `onboarding:review` or `onboarding:manage`
  - input:
    - `view`: `"submitted" | "changes_requested" | "recently_updated" | "rejected"`
    - `limit?: number`
  - output:
    - normalized queue rows only

- `getReviewDossier`
  - visibility: `.public()`
  - auth: FairLend staff boundary plus `onboarding:review` or `onboarding:manage`
  - input:
    - `applicationId`
  - output:
    - application read model
    - normalized evidence summary
    - review thread
    - downstream handoff summary

### Public Admin Review Mutations

Add `convex/onboarding/brokerApplication/reviewMutations.ts`.

Functions:

- `approve`
  - visibility: `.public()`
  - auth: FairLend staff boundary plus `onboarding:review`
  - input:
    - `applicationId`
    - `reviewerNote`
  - validation:
    - `reviewerNote.trim().length >= 10`
    - application status is `submitted`
  - behavior:
    - appends a `reviewer_note` with the reviewer note.
    - calls the internal approval path.
    - ensures downstream handoff status is included in the returned read model.

- `requestChanges`
  - visibility: `.public()`
  - auth: FairLend staff boundary plus `onboarding:review`
  - input:
    - `applicationId`
    - `reviewerNote`
    - `reopenedFields`
  - validation:
    - `reviewerNote.trim().length >= 10`
    - `reopenedFields.length >= 1`
    - each reopened field has a non-empty `fieldPath`
    - at least one reopened field must have either a reason or a global reviewer note that names the requested correction.
  - behavior:
    - calls strict internal request-changes path.
    - stores reopened fields and reverification invalidation.

- `reject`
  - visibility: `.public()`
  - auth: FairLend staff boundary plus `onboarding:review`
  - input:
    - `applicationId`
    - `reviewerNote`
  - validation:
    - `reviewerNote.trim().length >= 10`
  - behavior:
    - calls strict internal rejection path.

## Internal Helper Contract Changes

The internal helpers should be safe even when called by tests or future system code.

`convex/onboarding/brokerApplication/internal.ts` changes:

- `approveApplication`
  - add `body: v.string()` input.
  - reject blank or too-short reviewer notes for human reviewer actions.
  - append a `reviewer_note` carrying the approval reason.
  - preserve a separate `system_event` for downstream handoff creation if useful.

- `requestChanges`
  - require non-empty `body.trim()`.
  - require at least one reopened field.
  - reject blank `fieldPath`.
  - preserve structured reopened fields for correction UI.

- `rejectApplication`
  - already rejects blank body; align minimum length and error wording with approve/request changes.

System-initiated auto-approval and auto-rejection from verification recommendations may keep system-event notes, but human review commands must always record reviewer reasoning.

## Validation Rules

Reviewer note:

- Trim before validation and persistence.
- Minimum length: 10 characters.
- Error message: `Reviewer note must be at least 10 characters.`

Reopened fields:

- Request changes requires at least one reopened field.
- Each `fieldPath` must be non-empty after trimming.
- Duplicate `fieldPath` values are collapsed or rejected before persistence. Prefer rejection with `Reopened fields must be unique.`
- Stored field paths must match draft field paths that the broker correction UI can render.

Allowed reopened field paths:

- `selfReportedName`
- `licenseNumber`
- `licenseProvince`
- `brokerageName`
- `brokerageNumber`
- `requestedPortalSlug`
- `portalDisplayName`
- `portalBrandColor`

Reverification invalidation:

- Reopening `selfReportedName`, `licenseNumber`, or `licenseProvince` requires identity/regulator reverification.
- Reopening `brokerageName` or `brokerageNumber` requires regulator reverification.
- Reopening portal display or brand fields does not require IDV reverification.

## Permissions And Security

Broker-facing route and commands:

- require authenticated user with `onboarding:access`.
- may access only applications matching the viewer auth user or verified email.

Admin review queries and commands:

- require authenticated FairLend staff boundary.
- require `onboarding:review` for decisions.
- allow `onboarding:manage` for queue/dossier read-only management surfaces if this matches existing permission policy.
- must not be reachable from broker-facing routes.

No review command should trust client-supplied author metadata. Public commands derive `authorAuthId` and `authorType` from the authenticated viewer.

## Data Model

No new table is required.

Use existing tables:

- `brokerOnboardingApplications`
- `brokerOnboardingReviewEntries`
- `auditJournal`
- `auditLog`

Possible schema additions are limited to improving typed review evidence:

- Add `reviewAction?: "approve" | "request_changes" | "reject"` to `brokerOnboardingReviewEntries.metadata` by convention, not as a new top-level field.
- Keep `reopenedFields` on review entries for request-changes entries.

The route and admin review UI should not store local review state outside form controls.

## Auditability

Every reviewer action records:

- actor auth id
- actor type
- timestamp
- application id
- previous status
- new status
- reviewer note
- reopened fields for request changes
- reverification flags or field paths when applicable
- downstream handoff status for approval

The append-only review thread is the human-readable review history. Audit journal/audit log remain the regulatory and operational evidence layers.

## Testing

Backend tests:

- `approveApplication` rejects missing, blank, and too-short reviewer notes for human review actions.
- Admin `approve` mutation requires FairLend staff plus `onboarding:review`.
- Admin `approve` mutation appends a reviewer note and transitions through governed commands.
- `requestChanges` rejects blank notes.
- `requestChanges` rejects empty reopened fields.
- `requestChanges` rejects blank or duplicate reopened field paths.
- `requestChanges` persists reopened fields and reverification invalidation.
- `rejectApplication` enforces the same reviewer-note minimum as other decision actions.
- Broker-facing users cannot call admin review commands.
- Admin queue filters return submitted, changes-requested, recently-updated, and rejected applications.
- Dossier projection includes normalized verification snapshot, reason codes, evidence references, review thread, and downstream handoff status.

Frontend tests:

- `/onboard` renders a production broker onboarding screen instead of an empty outlet.
- No current application starts or resumes an application and then renders draft state.
- Draft state renders chapter progress and saves through `saveDraft`.
- Submitted state renders status, review thread, portal preview, and broker-note form.
- Changes-requested state renders only reopened correction fields and reverification requirements.
- Approved state does not render activation-complete messaging while downstream handoff is still in progress.
- Activated state renders activation outcome and broker workspace/portal navigation.
- Admin review queue renders the required views.
- Admin dossier renders normalized evidence and review thread.
- Approve/reject forms require a reviewer note before submit.
- Request-changes form requires a reviewer note and at least one reopened field.

Browser verification:

- Open `http://app.localhost:3000/onboard` as an onboarding-access member.
- Confirm a real production broker onboarding screen renders.
- Refresh and confirm the same application resumes.
- Submit a mock-provider application and confirm the submitted status page renders.
- Put an application into `changes_requested` from admin review and confirm broker correction mode renders only reopened fields.
- Approve an application from admin review and confirm the admin UI shows approval but distinguishes downstream activation.

Validation commands:

- `bun check`
- `bun typecheck`
- `bunx convex codegen`
- `bun run test src/test/convex/onboarding/brokerApplication.aggregate.test.ts`
- `bun run test src/test/convex/onboarding/brokerApplication.handoff.test.ts`
- `bun run test src/test/convex/onboarding/brokerApplication.review.test.ts`
- `bun run test src/test/onboarding/broker-onboarding-route.test.tsx`
- `bun run test src/test/admin/broker-onboarding-review.test.tsx`

## Implementation Notes

- Keep `src/routes/onboard/route.tsx` as the auth-gated layout and add the concrete screen in `src/routes/onboard/index.tsx`.
- Use the existing `api.onboarding.brokerApplication` functions for broker-facing reads and writes.
- Add admin review API modules instead of exposing internal helpers directly to React.
- Use shared portal helper functions for slug normalization and host preview. Do not copy slug logic into React components.
- Treat the demo broker white-label flow as visual inspiration only.
- Keep backend review validations stricter than UI validations so invalid review commands fail closed.
- Keep auto-approval from verification runtime separate from human reviewer approval. Auto-approval may use system events; human approval must store reviewer notes.

## Rollout

1. Ship backend review command hardening first.
2. Ship admin queue/dossier and review-action UI.
3. Ship `/onboard` production broker route.
4. Run focused backend and frontend tests.
5. Run repo validation commands.
6. Manually verify `/onboard` in the in-app browser.

This ordering prevents the new broker and admin UIs from binding to loose review contracts that would need to be replaced immediately.
