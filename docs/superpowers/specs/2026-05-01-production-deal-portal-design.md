# Production Deal Portal Design

## Purpose

Design a production-grade deal portal for locked marketplace deals. The portal gives all deal participants one canonical place to track and complete closing:

1. Legal representation
2. Document signing
3. Payment confirmation
4. Deal complete

The portal must not fork the closing lifecycle outside the governed deal machine. It should turn the existing deal, legal representation, document package, Documenso, payment, cash ledger, and audit primitives into a complete role-aware product surface.

## Source Context

Relevant project context reviewed:

- Notion goal: "Enable legal representation on every deal with minimal friction"
- `convex/engine/machines/deal.machine.ts`
- `convex/engine/transition.ts`
- `convex/checkout/dealHandoff.ts`
- `convex/legalRepresentation/*`
- `convex/deals/lawyerMutations.ts`
- `convex/deals/envelopes.ts`
- `convex/deals/envelopeWebhooks.ts`
- `convex/deals/closeEvidence.ts`
- `convex/documents/dealPackages.ts`
- `convex/documents/signature/*`
- `convex/payments/transfers/*`
- `convex/payments/cashLedger/*`
- `src/components/deals/participant/ParticipantDealWorkspacePage.tsx`
- `src/components/lawyer/deals/LawyerDealWorkspacePage.tsx`
- `src/components/legal-representation/LegalRepresentationStatusPanel.tsx`
- `src/components/admin/deals/DealOperationsConsole.tsx`
- `docs/architecture/legal-representation-contracts.md`
- `docs/architecture/document-engine-documenso-footguns.md`
- `docs/technical-design/unified-payment-rails.md`
- `docs/superpowers/specs/2026-04-30-demo-deal-closing-documenso-signing-design.md`

Important baseline:

- WorkOS AuthKit is the canonical identity provider.
- WorkOS has a canonical `lawyer` role. `platform_lawyer` and `guest_lawyer` are FairLend deal-scoped roles in `dealAccess`.
- `dealAccess` is the private deal resource boundary.
- Deals already store selected lawyer context through `lawyerId`, `lawyerType`, and `selectedLawyer`.
- The current successful terminal deal machine state is `confirmed`; the product may call this "deal complete", but the persisted governed status should remain `confirmed`.
- The demo signing route is a harness, not the production deal portal.

## Decisions

- Use one shared deal portal shell and one shared server route model.
- Render role-specific modules inside the shared shell for lender, selected lawyer, broker, seller, and admin.
- Keep the current governed deal machine vocabulary.
- Do not add an admin-only representation transition. Admin override writes explicit representation evidence, then fires the existing `REPRESENTATION_CONFIRMED` transition.
- Create the deal and package workspace on `DEAL_LOCKED`, but generate/send signable Documenso envelopes only after representation is confirmed.
- Manual wire proof can be uploaded by the lender, the selected deal lawyer, and admin.
- Broker and seller can view payment status but cannot upload proof in this scope. Granting those roles upload capability requires a separate policy change.
- Admin approval of manual payment proof is the only path that finalizes an off-platform payment proof into canonical funds evidence and the governed `FUNDS_RECEIVED` transition.
- Payment proof and payment confirmation must be tracked through the universal payment rails and cash ledger. The portal cannot close a deal by patching deal status directly.

## Goals

- A locked deal always has a production deal portal.
- No deal reaches document signing without legal representation confirmation or explicit admin override evidence.
- Both guest lawyer and platform lawyer invitation paths can route through WorkOS auth/onboarding and return the lawyer to the deal portal representation screen.
- Document signing uses Documenso embedded signing through backend-issued sessions.
- Manual wire proof upload creates reviewable evidence, not immediate close.
- Admin approval creates canonical payment/funds evidence, links cash ledger records, and then advances the governed deal.
- The final complete screen explains what happened, who participated, which artifacts were signed, what funds evidence was accepted, which cash ledger records were created, and which governed/audit events occurred.

## Non-Goals

- Replacing WorkOS AuthKit.
- Adding global WorkOS roles named `platform_lawyer` or `guest_lawyer`.
- Replacing the governed transition engine.
- Building a parallel document-signing system outside Documenso.
- Shipping real Vopay payment initiation in this spec. The payment screen should leave a provider-ready interface for Vopay, but manual wire proof is the production path for this work.
- Retiring existing participant/admin/lawyer pages in one step. Existing routes may be adapted to the shared projection or redirected incrementally.

## Canonical Lifecycle

The portal maps the existing deal machine to product screens:

```text
initiated
  -> DEAL_LOCKED
lawyerOnboarding.pending
  -> LAWYER_VERIFIED
lawyerOnboarding.verified
  -> REPRESENTATION_CONFIRMED
documentReview.pending
  -> LAWYER_APPROVED_DOCUMENTS
documentReview.signed
  -> ALL_PARTIES_SIGNED
fundsTransfer.pending
  -> FUNDS_RECEIVED
confirmed
```

Screen mapping:

| Deal status | Portal screen | Product meaning |
| --- | --- | --- |
| `lawyerOnboarding.pending` | Representation | Lawyer invitation, auth/onboarding, verification, and access are in progress. |
| `lawyerOnboarding.verified` | Representation | Lawyer is verified and must confirm representation, or admin must record override evidence. |
| `documentReview.pending` | Documents | Representation is confirmed; signable package generation and lawyer document approval happen here. |
| `documentReview.signed` | Documents | Package is approved and signing is underway. |
| `fundsTransfer.pending` | Payment | Required documents are signed; funds proof/payment is required. |
| `confirmed` | Complete | Deal has closed successfully under the governed machine. |
| `failed` | Terminal exception | Deal was cancelled or failed and should show a failure summary instead of active steps. |

## Shared Portal Shell

The portal should be backed by a single query contract, for example:

```text
deals.portalQueries.getDealPortalWorkspace({ dealId })
```

The exact module name can follow repo conventions, but the contract should be a single server projection rather than UI-side stitching. The projection should return:

- viewer identity summary
- viewer role for this deal
- available capabilities
- deal status and active screen
- current blockers
- next action text
- parties and deal access grants
- legal representation status
- document package, instances, recipients, and signing exceptions
- payment proof and review status
- transfer/cash ledger references
- close evidence and close effect outcomes
- audit timeline
- safe portal links for role-specific navigation

The frontend should not infer permissions from route names, auth roles, or local status checks. It should render action controls only from server-projected capabilities.

## Roles And Capabilities

### Admin

Admin can:

- view all portal screens and evidence
- resend, cancel, and replace lawyer invitations
- record admin representation override evidence
- trigger or retry package generation after representation confirmation
- view and resolve signing exceptions
- upload payment proof on behalf of a party
- review, approve, or reject manual payment proof
- view full cash ledger references, transfer records, close evidence, effect outcomes, and audit timeline

### Lender

Lender can:

- view all non-redacted deal portal screens for their deal
- view lawyer invitation and onboarding status
- cancel and replace lawyer invitations while before document review
- sign documents when they are an assigned Documenso recipient
- upload manual wire proof on the payment screen
- view payment review status and deal completion summary

### Selected Deal Lawyer

The selected lawyer is represented by deal-scoped `platform_lawyer` or `guest_lawyer` access.

Selected lawyer can:

- accept invitation and complete WorkOS auth/onboarding
- return to the deal portal representation screen after auth/onboarding
- confirm representation when legal gates allow it
- review and approve the package for signing
- sign/approve assigned Documenso documents
- upload manual wire proof on behalf of the lender if they have active lawyer access for the deal
- view deal completion summary and assigned evidence

### Broker

Broker can:

- view representation, document, payment, and completion status for deals they are authorized to see
- view blockers and next action summaries
- view participant-safe audit and timeline
- not upload payment proof by default
- not replace lawyer invitation in this scope

### Seller

Seller can:

- view representation, document, payment, and completion status for deals they are authorized to see
- sign documents when they are an assigned recipient
- view participant-safe completion summary
- not upload payment proof by default
- not access admin review evidence by default

## Screen 1: Legal Representation

The representation screen is the first active screen after a deal is locked. It displays:

- selected lawyer snapshot
- lawyer type: `platform_lawyer` or `guest_lawyer`
- invitation status
- WorkOS/auth/onboarding status
- LSO/profile/verification status
- engagement or admin override evidence status
- active lawyer deal access count
- blockers and next action
- current expiry times and resend/replace availability
- audit events for invitation, verification, access, and representation actions

### Guest Lawyer Path

1. Checkout or admin replacement selects a guest lawyer by name, email, firm, and optional LSO metadata.
2. The deal portal creates or shows a `lawyerInvitations` row for the guest lawyer.
3. The invitation link resolves the deal, target email, selected lawyer snapshot, and intended `guest_lawyer` access role.
4. The guest lawyer follows the link.
5. If not authenticated, WorkOS AuthKit handles sign-in or account creation.
6. If lawyer onboarding is incomplete, the user is routed through the lawyer onboarding flow immediately.
7. The onboarding/auth flow preserves the deal invitation context and return URL.
8. After completion, the user returns to the deal portal representation screen.
9. The backend resolves or provisions the lawyer profile, records verification evidence, migrates provisional email-based access to WorkOS auth ID where needed, and emits or enables `LAWYER_VERIFIED`.
10. The lawyer confirms representation in the portal, which fires `REPRESENTATION_CONFIRMED` when gates allow it.

### Platform Lawyer Path

1. Checkout or admin replacement selects a platform lawyer from configured eligible lawyer profiles.
2. The deal portal creates or shows a representation invitation for the selected platform lawyer.
3. The platform lawyer follows the invitation link.
4. If not authenticated, WorkOS AuthKit handles sign-in.
5. If platform lawyer onboarding, profile, eligibility, or training requirements are incomplete, the user is routed through the lawyer onboarding flow immediately.
6. The flow preserves the deal context and return URL.
7. After completion, the user returns to the deal portal representation screen.
8. Current verification/profile evidence enables `LAWYER_VERIFIED`.
9. The lawyer confirms representation in the portal, which fires `REPRESENTATION_CONFIRMED` when gates allow it.

### Lender And Admin Invitation Management

Before document review, lender and admin can:

- resend an active pending invitation
- cancel/revoke the current invitation
- replace the selected lawyer

Replacing the lawyer must:

- revoke prior active invitations
- revoke or supersede prior lawyer access when safe
- update selected lawyer snapshot fields
- create a new invitation for guest lawyer or platform lawyer
- record audit events
- keep the deal in the representation screen until the new lawyer is verified and representation is confirmed

### Admin Representation Override

Admin can confirm representation on behalf of the selected lawyer only by recording explicit evidence first.

The override record should include:

- deal id
- selected lawyer identity
- admin actor
- reason
- evidence note
- optional attachment ids
- timestamp
- source: `admin_override`

After writing evidence, the mutation fires the existing `REPRESENTATION_CONFIRMED` transition. The transition remains governed and audited.

## Screen 2: Document Signing

The document screen becomes active at `documentReview.pending`.

Document policy:

- On `DEAL_LOCKED`, create or link a deal document package workspace if needed.
- Do not create/send signable Documenso envelopes before representation is confirmed.
- On or after `REPRESENTATION_CONFIRMED`, generate/finalize the signable package and create Documenso envelopes.
- Keep generation idempotent and retryable.
- Preserve immutable package snapshots once generated.
- Run variable, signatory, and provider payload preflight before any Documenso provider call.
- Treat lifecycle gates as hard provider boundaries. `lawyerOnboarding.pending` and `lawyerOnboarding.verified` may have preview/review documents, but must never create or distribute provider envelopes.

The document screen displays:

- package status
- document instances
- signable/non-signable classifications
- required recipient roster
- signing order
- recipient status
- Documenso envelope status
- webhook and manual sync status
- open signing exceptions
- package generation and reissue controls for admin
- embedded signing launch controls for eligible recipients
- admin-only diagnostics for interpolation, signatory mapping, provider payload validation, provider errors, and cleanup/reissue attempts

### Document Engine Preflight Contract

Production package generation must make template/deal/provider compatibility explicit before provider calls.

The document engine should expose a typed preflight result for each signable template:

- template id and template version
- required variables
- resolved variables
- missing variables
- variable aliases applied
- variable source provenance
- template signatory roles
- resolved deal participant roles
- role aliases applied
- signature-capable field count per signer
- provider payload status: `not_applicable`, `valid`, or `invalid`
- provider validation errors

Variable rules:

- Template variables come from a registry, not arbitrary late-bound strings.
- Supported classes are `system`, `mapped`, `custom`, and `legacy_alias`.
- Missing variables produce deterministic configuration errors before provider calls.
- Generation snapshots store the variable keys used, values or redacted value hashes, and source table/entity provenance.
- Legacy variable aliases must be explicit, visible in preflight output, and test-covered.

Signatory rules:

- A single document role mapping contract owns canonical production roles, legacy/demo aliases, field-role equivalence rules, and UI labels/colors.
- Every template signatory role must resolve to a deal participant or explicit override.
- Every `signatory` recipient sent as a Documenso signer must have at least one signature-capable field after alias expansion.
- `viewer` and `approver` roles may have zero signature fields, but must not be sent as Documenso `SIGNER` recipients unless they have a signature-capable field and the package contract requires signing.
- Package publish and deal generation both fail if a signer can resolve to a recipient but has no signature-capable fields.
- Signable field roles must either appear in the template signatories or be covered by declared aliases.

### Documenso Provider Contract

Documenso-specific shape conversion must stay inside the provider adapter. The portal and document engine should not construct provider payloads directly.

Provider preflight must validate:

- each signer has at least one `SIGNATURE` or `FREE_SIGNATURE` field
- `field.type` uses Documenso provider values such as `SIGNATURE`
- `fieldMeta.type` uses the expected lower-case metadata literal such as `signature`
- field positions use valid percent bounds
- page numbers are valid and 1-based
- each recipient has name, email, provider role, deterministic signing order, and platform role
- multi-document envelopes use stable local identifiers

Provider response handling must:

- persist provider envelope ids and recipient ids
- match returned recipients by provider id if known, then email plus platform role, then email plus provider role plus submitted signing order, then email plus provider role fallback
- persist truncated provider response bodies on create/distribute/sync failures
- store provider errors on local envelope/document rows and expose them only through admin diagnostics
- avoid distribution when local provider preflight fails
- attempt remote cleanup if provider creation succeeds but local persistence fails, then archive the failed local attempt and store cleanup metadata

Lifecycle helper:

- Add or reuse one helper named `canStartSigningForDealStatus(status)`.
- Use the helper in package generation, embedded signing session creation, UI launch eligibility, admin diagnostics, and tests.
- For this portal, the helper returns true for `documentReview.pending` and `documentReview.signed` when an active envelope already exists; it returns false for lawyer onboarding states.

Active package surfaces:

- Exclude archived/superseded local document rows by default.
- Expose prior attempts only in an admin history or diagnostics view.
- Reissue/regeneration must archive obsolete local rows even when Documenso remote cleanup is not deletable.

Embedded signing rules:

- Frontend calls backend with only `dealId` and `dealDocumentInstanceId`.
- Backend derives viewer identity from WorkOS.
- Backend checks `dealAccess`.
- Backend matches the viewer to an eligible recipient.
- Backend issues the Documenso embedded signing session or token.
- Frontend renders Documenso embedded signing.
- Webhook-confirmed state remains the source of truth.
- Production routes use only recipient-launch signing. Demo/admin recipient impersonation launchers must not be callable from production portal routes.
- Embedded signing session issuance verifies deal id, instance ownership, deal status, envelope status, recipient id availability, and previous signing-order completion.

Progression:

- Lawyer/admin approval fires `LAWYER_APPROVED_DOCUMENTS`.
- Documenso webhook completion emits `ALL_PARTIES_SIGNED`.
- The portal moves to payment only after required recipient completion has been reconciled.

## Screen 3: Payment Confirmation

The payment screen becomes active at `fundsTransfer.pending`.

It must support two lanes:

1. Future provider lane for Vopay or other integrated payment initiation.
2. Current manual wire proof lane.

### Manual Wire Proof Upload

Allowed uploaders:

- lender
- selected deal lawyer
- admin

Proof upload captures:

- uploaded receipt asset ids
- amount
- currency
- received or transfer date
- sending party
- reference number
- institution or wire details when available
- freeform note
- uploader actor
- uploader role
- created timestamp

Accepted file types:

- PDF
- image files supported by the document asset pipeline

Upload result:

- creates a reviewable payment proof record
- links receipt assets
- appends audit evidence
- does not fire `FUNDS_RECEIVED`
- does not commit reservation
- does not transfer shares

### Admin Review

Admin review screen displays:

- uploaded receipt preview/download
- submitted amount and reference
- current deal purchase amount/fraction
- current transfer/payment status
- cash ledger posting preview or linked ledger entries
- duplicate proof warnings
- prior proof submissions
- audit history

Admin can:

- approve proof
- reject proof with reason
- request replacement proof
- upload proof on behalf of a party

Approval flow:

1. Validate deal is still `fundsTransfer.pending`.
2. Validate proof is pending review.
3. Validate receipt assets exist and are linked.
4. Create canonical funds evidence.
5. Create or link universal payment rails records for manual/off-platform funds.
6. Post or link required cash ledger entries.
7. Mark proof approved.
8. Fire `FUNDS_RECEIVED` with `fundsReceiptSource`.
9. Let governed effects commit reservation, prorate accrual, reroute future payments, and revoke lawyer access.

Rejection flow:

1. Mark proof rejected.
2. Store admin reason.
3. Keep deal in `fundsTransfer.pending`.
4. Keep uploader and other participants on the payment screen with status and next action.

Cash ledger rule:

- The portal cannot finalize a manual wire payment without a backend record tying the accepted proof to universal payment rails and cash ledger evidence.
- If ledger posting fails, the approval must fail or enter a blocked review state before `FUNDS_RECEIVED` is fired.

## Screen 4: Deal Complete

The complete screen is shown for `confirmed`.

Participant-safe summary:

- deal id
- property/mortgage summary
- buyer, seller, selected lawyer, broker
- share amount/fraction transferred
- completed date
- signed document archive status
- payment evidence type
- payment confirmation date
- high-level audit timeline

Admin summary adds:

- funds evidence details
- payment proof details
- attachment ids
- transfer ids
- cash ledger entry ids
- reservation id and commit outcome
- accrual proration outcome
- payment reroute outcome
- lawyer access cleanup outcome
- full governed transition timeline including rejected attempts

## Data Model Additions

Reuse existing legal, document, transfer, close evidence, and cash ledger tables where possible. Add only the narrow records needed for the production portal.

### Deal Portal Projection

No table required. This is a read model assembled from existing tables and new payment proof review records.

### Payment Proof Review

Add a table such as `dealPaymentProofs`:

```typescript
dealPaymentProofs: defineTable({
  dealId: v.id("deals"),
  submittedBy: v.string(),
  submittedByRole: v.union(
    v.literal("lender"),
    v.literal("platform_lawyer"),
    v.literal("guest_lawyer"),
    v.literal("admin"),
  ),
  status: v.union(
    v.literal("pending_review"),
    v.literal("approved"),
    v.literal("rejected"),
    v.literal("superseded"),
  ),
  amount: v.number(),
  currency: v.string(),
  transferDate: v.number(),
  referenceNumber: v.optional(v.string()),
  institutionName: v.optional(v.string()),
  note: v.optional(v.string()),
  attachmentIds: v.array(v.id("documentAssets")),
  reviewedBy: v.optional(v.string()),
  reviewedAt: v.optional(v.number()),
  reviewReason: v.optional(v.string()),
  fundsEvidenceId: v.optional(v.id("dealFundsEvidence")),
  transferRequestId: v.optional(v.id("transferRequests")),
  cashLedgerJournalEntryIds: v.optional(
    v.array(v.id("cash_ledger_journal_entries")),
  ),
  cashLedgerPostingGroupId: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_deal", ["dealId"])
  .index("by_deal_status", ["dealId", "status"])
```

Approved proof records should link to existing `cash_ledger_journal_entries`
rows directly when entries are known, and to a posting group id when the cash
ledger helper creates multiple entries as one accounting event.

### Representation Override Evidence

Prefer extending `representationEngagements` if its current schema can represent admin override evidence clearly. If not, add a narrow adjacent table such as `representationOverrideEvidence`.

Required fields:

- deal id
- selected lawyer auth/email snapshot
- admin actor
- reason
- optional attachment ids
- created timestamp
- transition journal entry id when the transition succeeds

## Convex API Surface

### Queries

- `getDealPortalWorkspace`
- `getDealPortalPaymentProofPreview` if preview payload is too heavy for the main workspace query
- existing admin/lawyer/lender queries may delegate to the shared projection during migration

### Mutations And Actions

Representation:

- resend invitation
- revoke invitation
- replace selected lawyer
- accept invitation and resolve WorkOS identity
- complete lawyer onboarding redirect resolution
- confirm representation
- admin override representation

Documents:

- ensure package workspace for locked deal
- generate signable package after representation confirmation
- retry package generation
- issue embedded signing session
- sync envelope state
- resolve/reissue signing exceptions

Payment:

- upload manual payment proof
- supersede or withdraw own pending proof where policy allows
- admin approve payment proof
- admin reject payment proof
- create/link manual payment rails evidence
- post/link cash ledger records
- fire `FUNDS_RECEIVED`

Completion:

- read close receipt
- read close effect outcomes
- read audit timeline

## Routing And Frontend Components

Recommended route shape:

```text
/deals/$dealId
```

Existing persona routes can redirect or wrap this route:

```text
/lender/deals/$dealId
/lawyer/deals/$dealId
/broker/deals/$dealId
/borrower/deals/$dealId
/admin/deals/$recordid
```

The production terminology in this spec uses "seller" for the deal counterparty.
Existing code may still expose that participant through borrower-oriented route
names; route naming cleanup is not required for the portal contract.

Core components:

- `DealPortalPage`
- `DealPortalShell`
- `DealPortalStepRail`
- `DealPortalHeader`
- `RepresentationScreen`
- `DocumentsScreen`
- `PaymentScreen`
- `CompleteScreen`
- `RoleModuleSlot`
- `AdminEvidencePanel`
- `ParticipantAuditTimeline`
- `PaymentProofUploader`
- `PaymentProofReviewPanel`
- `EmbeddedSigningPanel`
- `DealCompleteSummary`

UI design principles:

- operational, dense, and scannable
- no marketing layout
- no nested card stacks
- stable step rail and consistent action placement
- status and blockers always visible
- destructive actions require confirmation and reason
- uploads show validation and review status immediately

## Security And Authorization

- WorkOS AuthKit is the identity source.
- `dealAccess` is the deal resource boundary.
- Admin permission remains `admin:access` plus FairLend admin boundary checks.
- The server projection owns capabilities.
- Frontend never chooses signer email, provider recipient id, lawyer verification result, or payment close status.
- Embedded signing session creation accepts only deal/document ids and derives recipient identity server-side.
- Manual proof approval is admin-only.
- Payment proof upload is limited to lender, selected deal lawyer, and admin.
- Admin override must write evidence before transition.
- All state changes use governed transitions or explicit evidence mutations.
- Every destructive or close-finalizing action writes audit evidence.

## Error Handling

Representation blockers:

- no selected lawyer
- invitation expired
- invitation revoked
- invitation target mismatch
- WorkOS identity unresolved
- onboarding incomplete
- verification expired
- LSO restriction blocks representation
- engagement evidence missing
- selected lawyer mismatch

Document blockers:

- package workspace missing
- interpolation preflight failed
- signatory mapping preflight failed
- provider payload preflight failed
- package generation failed
- required variables missing
- signer has no signature-capable field
- recipient mapping incomplete
- pre-send configuration exception open
- Documenso create/send failed
- Documenso cleanup/reissue cleanup failed
- embedded signing token unavailable
- previous signing order incomplete
- webhook delayed
- document declined, voided, or expired

Payment blockers:

- no payment proof submitted
- proof has unsupported file type
- proof amount/currency mismatch
- duplicate proof conflict
- proof rejected
- cash ledger posting failed
- transfer/payment rails evidence failed
- deal no longer in `fundsTransfer.pending`

Completion blockers:

- signed archive missing
- reservation commit failed
- accrual proration failed
- payment reroute failed
- lawyer access cleanup failed

Each blocker should include:

- code
- severity
- user-facing message
- recoverable action when available
- admin-only diagnostic metadata when needed

## Testing

### Convex Tests

Cover:

- shared projection role redaction
- active screen derivation from every deal status
- lender invitation replacement before document review
- replacement blocked after document review
- guest lawyer invitation to WorkOS/onboarding return context
- platform lawyer invitation to WorkOS/onboarding return context
- `LAWYER_VERIFIED` legal gate behavior
- lawyer `REPRESENTATION_CONFIRMED`
- admin override evidence then `REPRESENTATION_CONFIRMED`
- signable package not sent before representation confirmation
- document variable preflight blocks missing variables before provider calls
- signatory mapping preflight blocks signers with zero signature-capable fields before provider calls
- legacy role aliases map recipients and fields together
- Documenso provider payload shape uses expected field type, field metadata type, page, position, identifier, role, and signing order values
- provider recipient ids persist when the provider response does not echo signing order exactly
- provider error bodies are persisted in admin-visible diagnostics
- signing lifecycle helper blocks provider calls and embedded signing in lawyer onboarding states
- archived/superseded document rows are excluded from active package surfaces
- package/envelope generation after representation confirmation
- embedded signing session authorization
- embedded signing refuses locked/lawyer-onboarding states and incomplete previous signing orders
- Documenso webhook `ALL_PARTIES_SIGNED`
- manual proof upload by lender, selected lawyer, and admin
- upload blocked for broker and seller
- admin proof rejection keeps deal in `fundsTransfer.pending`
- admin proof approval records funds evidence, cash ledger references, and fires `FUNDS_RECEIVED`
- `FUNDS_RECEIVED` causes reservation commit/share transfer/effects through governed flow
- complete screen projection for participant-safe and admin evidence

### React Tests

Cover:

- four-screen shell rendering
- role-specific action modules
- blocker display
- invitation replacement controls
- embedded signing unavailable/available states
- payment proof uploader validation
- admin review approve/reject states
- complete summary redaction by role

### Playwright Tests

Primary happy path:

1. Lock a deal through checkout handoff or seeded locked deal fixture.
2. Invite platform or guest lawyer.
3. Lawyer authenticates/onboards and returns to the representation screen.
4. Lawyer confirms representation.
5. Documents generate and embedded signing completes.
6. Lender or selected lawyer uploads wire proof.
7. Admin approves proof.
8. Deal reaches `confirmed`.
9. Complete screen shows share transfer, payment evidence, and audit timeline.

Blocked path:

1. Invite lawyer.
2. Let invitation expire or replace lawyer.
3. Confirm stale invitation cannot access the deal.
4. Verify portal shows recovery action and audit entry.

## Rollout Plan

1. Introduce shared portal projection behind existing routes.
2. Add payment proof review records and admin approval flow.
3. Move legal representation status/actions into the shared representation screen.
4. Gate signable package generation to representation-confirmed deals.
5. Add embedded signing screen using existing Documenso backend session rules.
6. Add payment screen upload/review/approval.
7. Add complete screen with close evidence and audit history.
8. Redirect or adapt existing lender, lawyer, broker, seller, and admin deal routes to the shared shell.
9. Add Playwright coverage for the production path.

## Acceptance Criteria

- A paid locked deal opens a production deal portal.
- The first active screen is representation until `REPRESENTATION_CONFIRMED`.
- Guest and platform lawyer invitation links route through WorkOS auth/onboarding and return to the deal portal.
- Admin can override representation only by writing evidence and using the existing governed transition.
- No signable Documenso envelope is sent before representation is confirmed.
- Required signers can sign through embedded Documenso sessions issued by the backend.
- All required signatures move the deal to payment through `ALL_PARTIES_SIGNED`.
- Lender, selected lawyer, and admin can upload manual payment proof.
- Broker and seller cannot upload manual payment proof by default.
- Admin can approve or reject manual payment proof.
- Approved proof creates canonical funds evidence, universal payment rails/cash ledger references, and then fires `FUNDS_RECEIVED`.
- Deal completion uses the governed `confirmed` state.
- The complete screen shows parties, outcome, audit history, signed documents, payment evidence, and close effect outcomes.
- `bun check`, `bun typecheck`, and `bunx convex codegen` pass after implementation.
