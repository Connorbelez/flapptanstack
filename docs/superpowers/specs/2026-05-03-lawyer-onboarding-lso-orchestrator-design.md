# Lawyer Onboarding And LSO Orchestrator Design

## Summary

FairLend already has large parts of the legal representation foundation in place: deal-scoped lawyer roles, WorkOS invitation delivery, legal representation status projections, verification and engagement gates, platform lawyer profile data, and platform availability/SLA primitives. The remaining gap is the orchestration layer that makes those pieces behave like a coherent lawyer onboarding product.

This design adds a deal-scoped legal onboarding orchestrator and scopes in LSO-backed guest lawyer selection. The system should route every lawyer entry point through the same server-driven checkpoint flow before granting full lawyer deal portal capabilities. Guest lawyers complete WorkOS auth, identity confirmation, LSO licence confirmation, mocked IDV, and deal engagement. Platform lawyers use the same evidence model, but their platform status, availability, and SLA data live in FairLend domain tables.

The LSO registry is modeled as a hybrid source: Convex stores an imported/searchable baseline, while provider boundaries allow targeted live refresh and restriction rechecks. Checkout must not depend on a live LSO request to proceed, but it must record freshness and block stale or restricted evidence at the legal gates.

For mortgage closing representation, selectable checkout results must be lawyers. The registry may store paralegal rows if they appear in imported LSO data, but paralegals are not eligible for this deal representation flow unless a later policy explicitly expands the permitted licensee types.

## Existing Infrastructure To Reuse

Do not rebuild these pieces:

- `lawyerInvitations` and WorkOS-backed delivery metadata.
- `legalRepresentation.workosInvitations` for sending, resending, revoking, resolving, and completing WorkOS invitations.
- `legalRepresentation.management` for resend, guest email change, lawyer replacement, and admin override actions.
- `lawyerProfiles`, `lawyerVerifications`, `representationEngagements`, platform lawyer assignment, availability, SLA, escalation, and restriction recheck tables where already present.
- `dealAccess.role = "platform_lawyer" | "guest_lawyer"` as the FairLend deal-scoped access distinction.
- Current state-machine events: `LAWYER_VERIFIED`, `REPRESENTATION_CONFIRMED`, and `LAWYER_APPROVED_DOCUMENTS`.

The new work connects and hardens these primitives instead of creating a parallel invite, profile, or gate system.

## External Reference Basis

The Law Society of Ontario is the public reference source for Ontario lawyer/paralegal licence status. LSO directs the public to its Lawyer and Paralegal Directory to confirm a legal professional's status, discipline history, and whether they are licensed and entitled to provide legal services. LSO also states that regulatory history, practice restrictions, or trusteeship information appears in directory listings when present.

Sources:

- [LSO Lawyer and Paralegal Directory](https://lso.ca/public-resources/finding-a-lawyer-or-paralegal/lawyer-and-paralegal-directory)
- [LSO Finding a Lawyer or Paralegal](https://lso.ca/public-resources/finding-a-lawyer-or-paralegal)
- [LSO Important Information](https://lso.ca/public-resources/finding-a-lawyer-or-paralegal/important-information)

## Architecture

The architecture has five cooperating layers.

### LSO Registry Layer

Convex holds the searchable baseline registry and evidence snapshots. Imports create immutable batch records and update the current searchable `lsoLawyers` projection. Targeted live refresh and periodic rechecks write new evidence rows and may update the current projection, but checkout can still function from the baseline when a provider is unavailable.

### Checkout Selection Layer

Marketplace checkout defaults to LSO-backed guest lawyer search. Manual guest entry remains an explicit fallback for admin/test/provider-outage policy, not the default path. Checkout snapshots include enough LSO metadata for deal handoff, invitation delivery, and later verification. Backend checkout validation must reread referenced LSO rows or use a fresh provider result; client-side restriction flags are never authoritative.

### Invitation And Identity Layer

WorkOS remains the identity bootstrap. FairLend keeps the local `lawyerInvitations` row as the deal-scoped authorization record. WorkOS invitation acceptance alone does not mean legal representation is verified; it only establishes the authenticated identity that can continue onboarding.

### Lawyer Onboarding Orchestrator

A new server-driven onboarding session determines the next required checkpoint after any lawyer entry point. It owns resume behavior, checkpoint status, evidence writes, route destinations, and blocked reasons. The orchestrator is the only product path that can convert a raw invitation/auth event into full lawyer deal access.

### Deal Portal Access Gate

The deal portal should distinguish identity targeting from full capability access. Matching the selected lawyer email may identify the invitation target and show a constrained onboarding-required state, but it must not grant lender-like controls or selected-lawyer capabilities. Full lawyer capabilities require WorkOS identity resolution, active deal access, current eligible LSO evidence, and the appropriate onboarding checkpoint.

## RBAC And Role Contract

The canonical WorkOS lawyer role is `lawyer`, with `lawyer:access` as the lawyer access permission.

`platform_lawyer` and `guest_lawyer` remain FairLend domain concepts only:

- `dealAccess.role`
- `deals.lawyerType`
- checkout `selectedLawyer.type`
- legal representation status projections
- deal portal personas
- SLA/availability logic

`platform_lawyer` must not be a target WorkOS role. The implementation should clean up current drift:

1. Canonicalize platform lawyer WorkOS checks to `lawyer` or `lawyer:access`.
2. Update seed helpers and tests that create `organizationMemberships.roleSlug = "platform_lawyer"` to use `lawyer`.
3. If compatibility with existing `platform_lawyer` memberships is needed during cleanup, isolate it behind an explicitly named drift/repair helper, not a product contract.
4. Add regression coverage proving the WorkOS role matrix has no `platform_lawyer` or `guest_lawyer` role.

Platform status belongs in FairLend data: `lawyerProfiles.profileKind`, `lawyerProfiles.platformStatus`, `platformLawyerAssignments`, availability, SLA, and related operational records.

## Data Model

### LSO Registry

Keep or extend `lsoLawyers` as the current searchable projection. Required fields:

- `lsoNumber` or `barNumber`
- `licenseeType`: `lawyer | paralegal`
- `displayName`
- normalized name/search tokens
- `businessName`
- `businessAddress`
- `city`
- `postalCode`
- `email` when available or manually supplied
- `phone`
- `practisingStatus`
- `entitledToPractise`
- `licensingStatus`
- `restrictionStatus`: `clear | restricted | suspended | requires_review | unknown`
- `restrictionSummary`
- `regulatoryHistorySummary`
- `directoryUrl`
- `source`: `lso_import | lso_live_refresh | manual_admin`
- `sourceVersion`
- `sourceFetchedAt`
- `lastRefreshedAt`
- `rawSnapshotHash`
- optional storage reference for a redacted raw provider snapshot

Indexes should support:

- normalized name prefix/token search
- bar/LSO number lookup
- status/restriction filtering
- source version/freshness scans

Add or extend:

- `lsoImportBatches`: source filename/reference, checksum, row counts, importedBy, importedAt, status, and aggregate errors.
- `lsoImportRowErrors`: batch id, row number, normalized key, error code, safe error message, raw row hash.
- `lsoLookupAttempts`: actor/deal context, query input, provider, result count, selected row id, status, failure reason, latency.
- `lsoRefreshRequests`: idempotent targeted refresh/recheck jobs for an LSO lawyer, lawyer profile, or deal.

### Onboarding Sessions

Add `lawyerOnboardingSessions`.

Core fields:

- `dealId`
- `invitationId`
- `lawyerProfileId`
- `workosUserId` or WorkOS auth id once known
- `path`: `guest_invited | platform_assigned | platform_application`
- `status`: `auth_pending | identity_pending | lso_pending | idv_pending | engagement_pending | complete | blocked | expired`
- `currentStep`
- `returnPath`
- `nextRoute`
- `blockedReasonCodes`
- `createdAt`
- `updatedAt`

Checkpoint timestamps:

- `authCompletedAt`
- `identityConfirmedAt`
- `lsoSubmittedAt`
- `lsoVerifiedAt`
- `idvCompletedAt`
- `engagementAcceptedAt`
- `completedAt`

The session should be idempotently findable by active invitation id, deal id + resolved lawyer auth id, and deal id + normalized invitation target email.

### Evidence

Reuse `lawyerVerifications` for LSO evidence when it can represent provider snapshots and freshness clearly. If not, extend it rather than adding a parallel verification table.

Add or extend identity evidence:

- mocked IDV provider result
- WorkOS email/name snapshot
- invitation target email
- explicit identity confirmation timestamp
- mismatch/block reason codes

Reuse `representationEngagements` for deal-specific engagement acceptance or signing. Onboarding completion can require accepted/signed engagement evidence, but representation confirmation still uses the existing governed transition gate.

### Access

`dealAccess` remains deal-scoped authorization. Email-based guest rows should be treated as provisional until migrated to WorkOS auth id. A provisional email row can identify a lawyer invitation target, but cannot unlock full selected-lawyer capabilities.

## API And Route Design

### Backend APIs

Add or extend these Convex surfaces:

- `legalRepresentation.lsoRegistry.searchLawyers`
- `legalRepresentation.lsoRegistry.importBatch`
- `legalRepresentation.lsoRegistry.refreshLawyer`
- `legalRepresentation.lsoRegistry.getImportBatch`
- `legalRepresentation.onboarding.startOrResumeForInvitation`
- `legalRepresentation.onboarding.startOrResumeForDeal`
- `legalRepresentation.onboarding.getLawyerOnboardingSession`
- `legalRepresentation.onboarding.confirmIdentity`
- `legalRepresentation.onboarding.submitLsoLicense`
- `legalRepresentation.onboarding.completeMockIdv`
- `legalRepresentation.onboarding.acceptRepresentationEngagement`
- `legalRepresentation.onboarding.completeSession`

Public route-facing mutations/actions must use the existing fluent-convex builder patterns and explicit `.public()` / `.internal()` visibility.

### Routes

`/lawyer/invitation`

- Accepts `invitation_token` from WorkOS.
- Resolves the WorkOS invitation.
- Starts or resumes a local onboarding session.
- Redirects to `/lawyer/onboarding/$sessionId`.
- Redirects directly to `/deals/$dealId` only when the session is already complete.

`/lawyer/onboarding/$sessionId`

- Renders the checkpoint wizard from the server projection.
- Never trusts client-computed next steps.
- Supports refresh/resume/retry without duplicating evidence.

`/deals/$dealId`

- If the viewer is the selected lawyer target but onboarding is incomplete, show a constrained onboarding-required state or redirect to the onboarding session.
- Do not expose lender controls or selected-lawyer capabilities before onboarding is complete.

`/admin/legal/lso`

- LSO import upload/preview/commit.
- Import batch diagnostics.
- Failed row remediation.
- Targeted refresh/recheck for a lawyer or profile.

`/lawyer/verify/$token`

- Legacy/manual fallback only.
- Should converge into the same onboarding session rather than completing a separate flow.

## User Flows

### LSO-Backed Guest Lawyer

1. Lender opens listing checkout.
2. Lender searches by LSO number or lawyer name.
3. System shows eligible and ineligible LSO matches with clear status.
4. Lender selects an eligible lawyer.
5. If LSO data lacks email, lender supplies contact email while keeping the LSO identity attached.
6. Checkout persists enriched `guest_lawyer` selected-lawyer snapshot.
7. Paid checkout creates or reuses the deal, grants provisional guest access, creates one local invitation, and sends WorkOS invitation.
8. Lawyer accepts WorkOS invitation and returns to `/lawyer/invitation`.
9. The route starts/resumes onboarding.
10. Lawyer confirms identity, confirms or enters LSO licence, completes mocked IDV, and accepts engagement.
11. System records evidence, migrates provisional email access to WorkOS auth id, and unlocks lawyer-specific deal portal capabilities.

### Manual Guest Fallback

Manual guest fallback can be used only under explicit fallback/admin/test policy. The selected lawyer snapshot is marked `source: "manual"`. The lawyer must enter LSO number and produce eligible LSO evidence during onboarding before representation can be confirmed.

### Platform Lawyer

Platform lawyers are WorkOS `lawyer` users with FairLend platform profile data. They do not receive a guest WorkOS invitation when already assigned. If their platform profile is incomplete or stale, the orchestrator routes them through platform checkpoints:

- profile confirmation
- LSO refresh/current evidence
- mocked IDV if missing
- availability/SLA setup when required for platform readiness
- deal-specific engagement when assigned to a deal

## UX Requirements

The UX should be operational and checkpoint-driven.

Checkout:

- Default guest flow is LSO search.
- Search rows show name, LSO/bar number, city/firm, practising status, restriction status, and contact availability.
- Ineligible results remain visible but disabled with a clear reason.
- Manual fallback is secondary and policy-gated.
- Missing LSO email triggers contact email input without losing LSO identity.

Guest onboarding:

1. Account connected
2. Confirm identity
3. LSO licence
4. Identity verification
5. Representation engagement
6. Deal access ready

Mocked compliance screens should still write provider-shaped evidence:

- identity confirmation stores WorkOS user snapshot and invite target comparison;
- LSO licence step stores selected/imported/refreshed registry evidence;
- mocked IDV writes an identity provider result;
- engagement acceptance writes deal-specific representation evidence.

Deal portal:

- incomplete lawyer sees constrained onboarding-required state;
- no lender-like controls;
- no representation confirmation action;
- primary action resumes onboarding;
- completed lawyer sees only lawyer-specific capabilities.

## Error Handling

Invitation/auth:

- WorkOS invitation token not linked: user-facing message and structured `workos_invitation_not_linked` log.
- WorkOS email mismatch: block, log local invitation id and WorkOS invitation id, never raw token.
- Repeated token use: resolve to existing onboarding session or terminal completed state.
- AuthKit wrong-host/wrong-path return: recover via invitation/deal context and route to session resume when possible.

LSO:

- Invalid import rows go to row-error records.
- Provider unavailable uses Convex baseline and marks freshness.
- Live refresh failure keeps prior evidence; if stale, mark `requires_review`.
- Restricted/suspended lawyer is visible but non-selectable.
- Manual fallback without LSO match can begin onboarding but blocks representation confirmation.

Onboarding:

- Missing session tries recovery by invitation id, deal id + verified email, or deal id + lawyer profile/auth id.
- Wrong authenticated user blocks with email mismatch reason.
- Duplicate checkpoint submission is idempotent by session/checkpoint.
- Expired sessions require resend or replace from lender/admin controls.

## Observability

Add structured logs around:

- invitation resolution and completion;
- onboarding session creation/resume;
- each checkpoint completion;
- LSO search/import/refresh decisions;
- deal portal access downgrades caused by incomplete onboarding;
- WorkOS `platform_lawyer` role drift detection/repair.

Logs should include ids, provider names, stage, status, reason codes, and actor auth id where safe. Do not log raw invitation tokens, raw provider payloads, or sensitive identity documents.

## Test Plan

Convex/schema tests:

- LSO import creates searchable rows and batch diagnostics.
- Invalid import rows are quarantined.
- Targeted refresh writes fresh evidence and preserves history.
- Onboarding session is idempotently created/resumed from invitation and deal context.
- Session checkpoints write immutable evidence.

Checkout tests:

- Eligible LSO lawyer can be selected.
- Restricted/suspended LSO lawyer cannot be selected by UI or API bypass.
- LSO lawyer without email requires contact email.
- Manual fallback is policy-gated and marked `source: "manual"`.
- Checkout selected-lawyer snapshot carries LSO metadata.

WorkOS/invitation tests:

- WorkOS invitation return starts onboarding instead of going straight to the deal.
- Replays reuse the same onboarding session.
- Email mismatch blocks safely.
- Resend/change/replace flows produce invitation links that resume onboarding.

Portal tests:

- Incomplete guest lawyer cannot get lender-like controls.
- Incomplete guest lawyer cannot get `representation.confirm`.
- Manually opening `/deals/$dealId` routes or constrains to onboarding-required state.
- Completed lawyer gets selected-lawyer capabilities only.

RBAC tests:

- WorkOS `lawyer` role satisfies platform lawyer identity evidence.
- WorkOS `platform_lawyer` is not required as product contract.
- Role matrix has no `platform_lawyer` or `guest_lawyer` WorkOS roles.
- FairLend `dealAccess.role` still supports `platform_lawyer` and `guest_lawyer`.

Route/component tests:

- `/lawyer/invitation` starts/resumes onboarding with `invitation_token`.
- `/lawyer/onboarding/$sessionId` progresses through guest checkpoints.
- Platform lawyer route skips guest invitation but enforces stale/missing evidence.
- LSO checkout search UI displays disabled restricted rows and missing-email prompts.

Verification commands:

- `bunx convex codegen`
- `bun typecheck`
- `bun check`
- targeted Convex legal representation and checkout tests
- targeted route/component tests for lawyer invitation, onboarding, and deal portal

## Definition Of Done

- LSO-backed guest search is the default checkout path.
- Manual guest fallback is explicit and policy-gated.
- WorkOS invitation links return to a FairLend onboarding session, not `localhost:3000` or a generic home page.
- Guest lawyers cannot bypass onboarding by manually opening a deal URL.
- Platform and guest lawyers share one evidence/gate model while preserving FairLend deal-scoped roles.
- WorkOS uses canonical `lawyer`; `platform_lawyer` and `guest_lawyer` are not target WorkOS roles.
- Mocked IDV and LSO refresh write provider-shaped evidence that can be replaced by real providers later.
- Resend/change/replace flows converge into onboarding and do not create duplicate active invitations or active lawyer access.
- Tests cover happy paths, blocked paths, replay/idempotency, RBAC drift, and route resume behavior.

## Open Implementation Notes

- The implementation should run impact analysis before editing current hot spots such as `selectedLawyerMatchesViewer`, `resolveViewerPersona`, `completeWorkosGuestInvitation`, `buildSelectedLawyerSnapshot`, platform lawyer profile role checks, and checkout selected-lawyer validation.
- Existing local drift should be cleaned up as part of the implementation plan, especially tests and seeds using WorkOS `platform_lawyer`.
- If the current `lawyerVerifications` schema cannot represent LSO import and live refresh evidence cleanly, prefer extending it over introducing a parallel verification source.
- If the current deal portal cannot display a constrained onboarding-required state without leaking lender controls, add an explicit persona/capability projection for `selected_lawyer_onboarding_required`.
