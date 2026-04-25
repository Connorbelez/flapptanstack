# Velocity Package Integration Design

## Purpose

FairLend will use Newton Velocity as the source of truth for lender synchronization, deal intake, underwriting activity, and upstream deal approval. FairLend’s boundary starts when Velocity sends package updates to our credentials, but FairLend should create an internal package workspace immediately so staff can monitor and enrich the file from the beginning.

The package workspace remains mutable until final activation. The canonical FairLend mortgage is created only after the Velocity package reaches the v1 terminal milestone, the FairLend-owned payment requirements are complete, staff confirm a final activation preview, and payment rails can be activated without bypasses.

This spec covers the design only. It does not implement the integration.

## Source Context

Velocity docs reviewed from `/Users/connor/Dev/newton-velocity-docs`:

- `webhooks.md`: webhooks are notifications for new deals and status updates. The webhook payload contains event metadata, `loanCode`, status, and a `deal` link; FairLend must fetch the full deal afterward.
- `deals.md` and `search-deals.md`: full deal fetches expose `loanCode`, `status`, `linkApplicationId`, `lenderReferenceNumber`, borrower details, subject property, mortgage request, conditions, notes, referral, and solicitor data.
- `enumerations.md`: Velocity status and enum mappings are numeric. Relevant deal statuses include `Accepted (4)`, `Waiting To Close (5)`, `Funded (6)`, and `Complete (7)`. Velocity payment frequencies include values FairLend does not currently support.

FairLend repo constraints reviewed:

- Canonical mortgage activation currently happens through `activateMortgageAggregate`.
- `mortgages.status` starts at `active`; there is no existing pre-active canonical mortgage state.
- Existing admin origination commits create the canonical mortgage, obligations, listing projection, ledger genesis, and audit rows. Its Rotessa activation path can fail after canonical commit, which is not acceptable for this Velocity path.
- FairLend payment frequencies currently support `monthly`, `bi_weekly`, `accelerated_bi_weekly`, and `weekly`.

## Decisions

- FairLend creates a dedicated `VelocityPackageWorkspace` from the first webhook/full fetch for any deal delivered to our Velocity credentials.
- Every webhook delivered to FairLend’s Velocity credentials is assumed FairLend-owned.
- This is not a two-way bridge. FairLend does not write back into Velocity in v1.
- `linkApplicationId` is the canonical 1:1 upstream identity key.
- `loanCode` is the primary staff-facing locator for finding the file in Velocity.
- `lenderReferenceNumber` is a secondary reference.
- Missing `linkApplicationId` or any identity collision creates a high-visibility exception.
- Velocity remains the source of truth for Velocity-owned core facts until activation completes.
- FairLend only fills FairLend-owned missing/enrichment fields.
- The upstream terminal milestone for v1 activation is `Funded (6)`.
- The canonical mortgage is not created at `Accepted`.
- Listing publication happens only after the canonical mortgage is live.
- Bank data is FairLend-owned and entered directly by staff.
- PAD evidence is FairLend-owned and uploaded as a PDF.
- PAD evidence is the only hard document requirement in v1.
- Required canonical activation inputs that Velocity does not expose or cannot map deterministically are package-owned FairLend remediation inputs in v1. Start with `loanType` and `lienPosition`; keep the same surface available for other derived-only fields if later mapping review proves they cannot be inferred safely.
- Staff trigger activation from the same package workspace used for uploads and FairLend-owned enrichment.
- The activation button is disabled until all requirements are satisfied.
- There is no force-activate override in v1.
- If Velocity core data changes after staff review, activation hard-stops and requires fresh review.
- Final review is a required coherent activation preview page.
- Unsupported Velocity payment frequencies route to remediation instead of being mapped approximately.

## Domain Model

Add a dedicated Velocity package aggregate instead of adapting the old `applicationPackages` underwriting model directly.

Proposed tables:

- `velocityPackageWorkspaces`
- `velocityPackageSnapshots`
- `velocityWebhookEvents`
- `velocitySyncAttempts`
- `velocityActivationAttempts`
- `velocityPackageExceptions`
- package-scoped links to the existing document asset surface for PAD evidence and manually uploaded supporting files

`velocityPackageWorkspaces` stores:

- canonical Velocity identity: `linkApplicationId`, `loanCode`, `lenderReferenceNumber`
- current upstream status code and label
- normalized Velocity-owned core snapshot
- FairLend-owned enrichment fields
- package-owned activation remediation fields for required canonical inputs Velocity does not provide or cannot map safely
- readiness state
- final review state and reviewed snapshot hash
- activation state and canonical mortgage links after success
- latest exception summary for board/query efficiency

Velocity-owned fields include borrower identity, subject property facts, loan economics, payment source terms, upstream status, and related deal facts from the full Velocity deal response.

FairLend-owned fields include bank account inputs, PAD PDF evidence, package-owned activation remediation inputs, staff notes, uploaded files, property images, comparables, listing enrichment, and internal workflow metadata.

## State Flow

Workspace states:

```text
in_progress
needs_fairlend_data
ready_for_review
final_review_required
ready_to_activate
activating
activation_failed_remediation
activated
```

Exception overlays:

```text
identity_exception
upstream_sync_exception
unsupported_mapping_exception
upstream_changed_after_review
activation_exception
live_drift_exception
```

Exceptions should be visible on the main package board and open into a dedicated remediation workspace. Staff should not need to start with raw logs.

## Ingestion And Sync

Velocity webhooks are notification-only. FairLend should persist the raw webhook, then fetch the full deal before mutating package state.

Flow:

```text
POST /api/velocity/webhook
  -> authenticate request
  -> persist raw webhook event
  -> preserve webhook agent metadata and credential-scoping context
  -> enqueue full deal fetch by `loanCode` against Deals Out, or follow the supplied deal link as an opaque fallback when Newton provides it
  -> normalize enums and core fields
  -> validate linkApplicationId identity
  -> create or update VelocityPackageWorkspace
  -> create upstream snapshot when core facts changed
  -> recompute readiness
  -> route exceptions to remediation
```

Webhook idempotency should use the event timestamp/type, `loanCode`, full-deal snapshot hash, and workspace identity. Duplicate webhooks must not create duplicate packages, duplicate snapshots, or duplicate activation work.

Staff get a `Sync now` action that runs the same fetch, normalize, snapshot, readiness, and remediation path as webhook processing.

Because the Velocity webhook docs reviewed do not show a request signature scheme, v1 should use a FairLend-controlled webhook secret or unguessable endpoint token and reject unknown requests before queueing work.

The Newton docs also describe webhooks as user-scoped and backed by the same API key system as the Velocity API. v1 should therefore treat webhook ingress and outbound deal fetch credentials as connector credentials with explicit provenance, rather than as an anonymous platform-wide feed.

## Mapping Rules

All Velocity enum codes must be normalized through explicit mapping tables with raw code preservation for audit/debugging.

Deal status:

- `0 Lead`, `1 New`, `2 Submitted`, `3 Approved`, `4 Accepted`, and `5 Waiting To Close` create and update the workspace but cannot activate.
- `6 Funded` is the v1 upstream activation milestone.
- `7 Complete` updates the workspace but does not enable v1 activation by itself. If a package reaches `Complete` before FairLend activation, it routes to remediation for staff/policy review because the agreed v1 activation milestone is current status `Funded (6)`.
- `8 Parked`, `9 Cancelled`, and `10 Declined` do not introduce new persisted workspace states in v1. FairLend should preserve the raw/current Velocity status, make the package non-actionable on the board, and route to exception/remediation semantics when local work or operator follow-up still exists.

Payment frequency:

- Velocity `Monthly (3)` maps to FairLend `monthly`.
- Velocity `Bi Weekly (1)` maps to FairLend `bi_weekly`.
- Velocity `Bi Weekly Acc (2)` maps to FairLend `accelerated_bi_weekly`.
- Velocity `Weekly (5)` maps to FairLend `weekly`.
- Velocity `Semi Monthly (4)` is unsupported in v1 and blocks activation.
- Velocity `Weekly Acc (6)` is unsupported in v1 and blocks activation.

Any required canonical activation input that is absent or unsupported becomes a readiness/remediation blocker. It must not be defaulted silently.

Current activation requires fields such as lien position, loan type, principal, rate type, interest rate, term dates, maturity date, first payment date, amortization, payment amount, and payment frequency. The current Newton Deals Out docs expose the economics, rates, dates, and payment frequency inside `mortgageRequest`, but they do not expose `loanType` or `lienPosition`. If Velocity does not expose a field or the mapping is ambiguous, the package remains pre-activation and staff remediation must make the FairLend-owned or policy-owned value explicit.

## FairLend-Owned Payment Inputs

Bank data is entered directly by staff inside the package workspace.

PAD evidence is an uploaded PDF and is required before activation.

Other required canonical activation inputs that Velocity does not supply or cannot map unambiguously are also package-owned FairLend inputs. In v1 this explicitly includes `loanType` and `lienPosition`.

There is no separate bank/PAD verification step in v1. The required final package review is the verification gate for all activation inputs.

Non-PAD documents are not hard go-live requirements in v1. They can be uploaded or manually entered before payment activation, but missing non-PAD documents do not block activation.

## Final Review

Final review is a single coherent activation preview generated from the same mapper used by activation.

It must show:

- immutable mortgage economics and term inputs
- borrower identities and roles
- subject property facts
- FairLend-owned bank input summary
- PAD evidence status and document link
- Rotessa customer/schedule inputs
- payment schedule preview
- listing publication timing
- provenance identifiers: `linkApplicationId`, `loanCode`, `lenderReferenceNumber`, workspace id, snapshot id
- warnings or blockers for unsupported/missing mappings

Staff confirmation stores the reviewed snapshot hash. If Velocity-owned core data changes after confirmation, activation is disabled and the package moves to `upstream_changed_after_review`.

## Activation And Handoff

The Velocity activation path should reuse the canonical backend activation semantics where possible, especially `activateMortgageAggregate`, but should not drive the old admin UI workflow and should not inherit its post-commit Rotessa failure behavior.

Activation flow:

```text
staff clicks Activate
  -> verify package is still at reviewed version
  -> verify Velocity status is Funded (6)
  -> verify no upstream core changes since final review
  -> verify bank fields, PAD PDF, and required mappings
  -> create or verify Rotessa customer and payment schedule idempotently
  -> create canonical mortgage aggregate
  -> create obligations, payment schedule, listing projection, ledger genesis, and audit
  -> mark package activated and link canonical mortgage
```

The all-or-nothing rule is user-facing: if Rotessa/payment activation cannot be completed, no canonical live mortgage should be created. The mutable package remains available for remediation with the exact failure cause.

Because external provider calls cannot be rolled back transactionally with Convex database writes, activation attempts need durable idempotency keys and explicit compensation/remediation records. If FairLend creates external Rotessa artifacts and then fails before canonical mortgage activation completes, retry must either reuse those artifacts safely or surface a compensation task. The live mortgage must still not exist until the canonical activation step succeeds.

Recommended provenance constants:

```text
creationSource: velocity_package
originationPath: velocity
workflowSourceType: velocity_package
workflowSourceId: <velocityPackageWorkspaceId>
workflowSourceKey: velocity_package:mortgage:<linkApplicationId>
```

`activateMortgageAggregate` already enforces idempotency by `workflowSourceKey`; the Velocity path should preserve that property.

Once activated, core borrower/property/loan/payment facts are immutable in FairLend. Later Velocity changes create `live_drift_exception` records and do not mutate the canonical mortgage.

## UI Workflow Requirements

Full UI mockups are deferred, but the staff workflow requirements are:

- A Velocity package board with hybrid visibility: upstream Velocity stage plus FairLend action state.
- A high-visibility exception/remediation swimlane.
- A package workspace where staff can see Velocity locators, review locked Velocity-owned fields, edit FairLend-owned fields, upload PAD evidence, add files, and run `Sync now`.
- Activation readiness indicators that explain why activation is disabled.
- A final activation preview page before activation.
- A remediation workspace that shows the failing requirement, raw/system error, latest relevant snapshot, repair controls, and retry path.

## Audit And Provenance

Every Velocity package needs an append-only audit trail separate from the eventual mortgage audit trail.

Snapshots, sync attempts, activation attempts, and exception rows are operational state. They are not the audit trail by themselves. Package lifecycle events should write through the existing append-only audit pipeline wherever possible, with enough provenance to tie webhook agent identity, connector credential scope, package review, and canonical mortgage creation together.

Audit events should cover:

- raw webhook receipt
- full deal fetch attempts and failures
- normalization/mapping results
- identity validation and collisions
- Velocity-owned snapshot creation
- FairLend-owned edits
- PAD PDF upload/linking
- readiness recomputation
- final review confirmation
- activation attempts
- Rotessa/customer/schedule creation or reuse
- activation failure/remediation
- successful canonical mortgage creation
- post-live Velocity drift

Activation provenance should flow into the canonical mortgage audit journal with the Velocity identifiers, package snapshot id, reviewer user id, activation attempt id, and canonical record ids created during activation.

## Recommended Implementation Slices

- contracts, schema, ingress provenance, and audit primitives
- webhook ingestion, full-deal sync, and sync-side audit coverage
- workspace queries, readiness evaluation, document linking, and package-owned activation remediation inputs
- board, workspace, and remediation UI
- reviewed activation orchestration plus final review and activation UI wiring
- mock Velocity harness and backend regression coverage
- operator workflow integration and end-to-end coverage

## Mock Velocity Harness

The mock system should simulate Velocity rather than bypass FairLend ingestion.

Proposed dev endpoints:

```text
POST /api/dev/velocity/scenarios
POST /api/dev/velocity/webhook
GET  /api/dev/mock-velocity/v1/deals?loancode=...
POST /api/dev/mock-velocity/v1/deals/search
PATCH /api/dev/mock-velocity/deals/:loanCode
```

Scenario creation should store a mock Velocity deal, then fire a realistic webhook. FairLend should receive the webhook, fetch the mock full deal through the mock GET/search endpoint, and run the production ingestion path.

Scenario parameters should support bounded randomization:

```json
{
  "status": 6,
  "borrowerCount": { "min": 1, "max": 2 },
  "province": ["ON", "BC", "AB"],
  "principal": { "min": 150000, "max": 900000 },
  "rate": { "min": 6.5, "max": 12.5 },
  "termMonths": [12, 24, 36],
  "amortizationMonths": [240, 300],
  "paymentFrequency": [1, 2, 3, 4, 5, 6],
  "missingLinkApplicationId": false,
  "duplicateLinkApplicationId": false,
  "simulateUpstreamChangeAfterReview": false,
  "simulateRotessaCustomerFailure": false,
  "simulateRotessaScheduleFailure": false,
  "unsupportedEnum": false
}
```

Required scenarios:

- successful package creation from early status
- status progression to `Funded (6)`
- missing `linkApplicationId`
- duplicate `linkApplicationId`
- unsupported enum
- unsupported payment frequency
- missing required core field
- upstream core change after final review
- missing PAD
- incomplete bank data
- Rotessa customer failure
- Rotessa schedule failure
- retry after remediation
- successful all-or-nothing activation
- post-live Velocity drift

## Testing Requirements

Automated tests should verify:

- webhook idempotency
- full-deal fetch is required before workspace mutation
- 1:1 identity guarantee by `linkApplicationId`
- identity exception behavior
- snapshot creation on upstream core changes
- FairLend-owned edits do not overwrite Velocity-owned facts
- `Sync now` uses the same ingestion path as webhooks
- readiness gates for `Funded`, PAD, bank data, mappings, and final review
- final review invalidation after upstream changes
- unsupported payment frequencies block activation
- activation has no override path
- Rotessa/payment failures do not create a canonical mortgage
- retries are idempotent
- successful activation creates canonical mortgage, obligations, collection plan entries, listing projection, ledger genesis, audit, and package links
- listing publication only happens after live activation
- post-live Velocity changes create drift exceptions instead of mutating the mortgage

Core invariant: tests must not create a live canonical mortgage unless the same readiness and activation gates passed.

## Non-Goals

- No two-way Velocity sync in v1.
- No Velocity document pull dependency in v1.
- No pre-active canonical `mortgages` state in v1.
- No force activation or staff override path in v1.
- No marketplace/listing publication before live activation.
- No reuse of the old underwriting `applicationPackages` model as the canonical Velocity workspace.
- No support for `Semi Monthly` or `Weekly Acc` activation in v1.
