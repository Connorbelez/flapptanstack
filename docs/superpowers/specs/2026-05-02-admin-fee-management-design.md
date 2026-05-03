# Admin Fee Management Design

## Purpose

FairLend needs a first-class admin experience for configuring, applying, and tracing fees across the platform and individual mortgages. The design must extend the existing fee template system rather than introduce a parallel billing system.

The current canonical fee configuration model is:

- `feeTemplates`: platform-wide fee definitions.
- `feeSetTemplates`: reusable bundles of fee templates.
- `feeSetTemplateItems`: links templates into sets.
- `mortgageFees`: per-mortgage runtime snapshots with effective windows.

This design keeps those concepts as the canonical system and refactors them to support explicit fee behaviors, payment rail selection, mortgage-level application, bulk apply, ledger traceability, and admin income reporting.

## Approved Direction

Use one umbrella design with phased implementation. The target model is defined end to end now, but implementation can land in cohesive slices.

Admin-created fee names are flexible, but the underlying behavior is controlled. A fee definition can be named "Renewal Admin Fee" or "Servicing Spread", but it must use one supported behavior:

- `borrower_one_time_charge`
- `borrower_recurring_charge`
- `payment_waterfall_deduction`

Platform-wide fee sets apply by default to new mortgages with explicit opt-out or override during origination or activation. Existing mortgages are never silently changed. Admins can bulk-apply a fee set to existing mortgages through a preview and confirmation workflow.

For future-payment deductions, the borrower scheduled debit stays the same. FairLend takes the configured fee from settled borrower cash before lender distribution.

## Data Model

### Fee Definitions

`feeTemplates` become behavior-aware platform fee definitions.

They keep the current fields for name, description, calculation parameters, revenue destination, and status. They gain an explicit `behavior` field that new code should use as the main dispatch point.

The existing `code` and `surface` fields can remain during migration and compatibility. Built-in historical fees map as follows:

| Existing fee | Target behavior |
| --- | --- |
| `servicing` / `waterfall_deduction` | `payment_waterfall_deduction` |
| `late_fee` / `borrower_charge` | `borrower_one_time_charge` or governed late-fee rule behavior |
| `nsf` / `borrower_charge` | `borrower_one_time_charge` |

Fee definitions should include:

- custom admin-facing name
- controlled behavior
- calculation type and parameters
- default payment rail/provider options for borrower-payable fees
- default priority for waterfall deductions
- revenue destination
- status and audit metadata

### Fee Sets

`feeSetTemplates` remain platform bundles of definitions.

They should support:

- active/inactive status
- one or more default fee sets for new mortgages, with a clear default selector
- ordered fee items
- optional opt-out semantics at origination/activation
- bulk apply to existing mortgages through preview

### Mortgage Fee Applications

`mortgageFees` remain the per-mortgage active configuration snapshot.

They should hold:

- `mortgageId`
- source `feeTemplateId`
- source `feeSetTemplateId` and item id when inherited from a set
- behavior
- effective date window
- calculation parameters after overrides
- payment rail/provider configuration
- recurrence configuration when applicable
- waterfall priority when applicable
- status and deactivation metadata
- admin actor/audit references

Changing a fee definition later must not mutate existing `mortgageFees` rows. A mortgage application is the economic snapshot used for future assessment.

### Fee Assessments

Add a new runtime table named `feeAssessments` for actual applied fee instances.

A fee assessment records that a configured mortgage fee was applied to a specific borrower charge or settlement event.

It should link backward to:

- fee definition/template
- fee set when inherited
- mortgage fee application
- mortgage
- admin actor or system actor
- audit journal entry

It should link forward to related execution records where applicable:

- `obligationId`
- `collectionPlanEntryId`
- `collectionAttemptId`
- `transferRequestId`
- `dispersalCalculationRunId`
- `servicingFeeEntryId` or generalized waterfall fee entry
- cash ledger posting group id
- cash ledger journal entry ids

This gives admins a trace view without using configuration rows as the record of what actually happened.

## Fee Behaviors

### One-Time Borrower Charge

An admin applies a fee to one mortgage and chooses:

- borrower
- amount or calculated value
- due date
- payment rail/provider
- reason
- optional evidence/reference metadata

The system creates:

- one `feeAssessment`
- one borrower obligation
- one collection plan entry or scheduled collection path
- transfer execution through the universal payment rails

This is the correct path for ad hoc admin fees.

### Recurring Borrower Charge

An admin attaches a recurring fee to a mortgage and configures:

- borrower
- amount or calculation rule
- cadence
- start date
- end date or max occurrences
- payment rail/provider
- reason

The recurring configuration lives on the mortgage fee application. Each generated occurrence creates its own fee assessment and borrower obligation.

Recurring generation should reuse existing obligation and collection-plan scheduling patterns where possible. The design should avoid creating a fee-only scheduler that bypasses the payment rails.

### Payment Waterfall Deduction

An admin attaches a fee to an active paying mortgage with:

- effective date window
- calculation rule
- waterfall priority
- optional max amount, max occurrence count, or end condition
- traceable reason

When an eligible borrower payment settles, dispersal resolves active waterfall fee applications, computes the fee amounts, creates fee assessments, subtracts the fee total from lender-distributable cash, and posts platform revenue entries in the cash ledger.

The borrower debit does not change. The fee is taken before lender distribution.

The current servicing fee becomes the built-in default instance of this behavior, not a separate special mechanism.

## Admin UX

### `/admin/fees`

Create a dedicated admin fee management page.

Primary areas:

- Fee Definitions
- Fee Sets
- Mortgage Applications
- Fee Assessments

Core actions:

- create/edit/deactivate fee definitions
- create/edit/deactivate fee sets
- mark a fee set as default for new mortgages
- apply a fee definition to a mortgage
- apply a fee set to a mortgage
- bulk-apply a fee set to existing mortgages
- view fee assessment trace details

Definition and application rows must show the configured fee value, such as `1.00% annual`, `$50 fixed`, or `$195 fixed`. Admins should not need to open a row to understand what a fee takes.

### Mortgage Detail Page

Add a dedicated `Fees` section near the existing `Payments/Obligations` section.

It should show:

- active fees
- inherited defaults
- mortgage-specific overrides
- configured value/rate
- behavior
- effective window
- next expected action
- status
- trace links to obligations, transfers, dispersal runs, and cash ledger entries

Actions:

- apply fee
- override defaults
- deactivate fee
- create one-time borrower charge
- open fee trace

### `/admin` Landing Page

Add fee income metrics to the admin landing page.

Metrics should include:

- total recognized fee income
- recognized waterfall fee income
- collected borrower-charge fee income
- open fee receivables
- fee income by fee type
- assessment count by fee type

The source of truth for income is ledger-recognized activity and collected borrower fee obligations, not fee configuration.

### Bulk Apply Workflow

Bulk apply should be a guided workflow:

1. Choose fee set.
2. Filter target mortgages.
3. Preview conflicts and skipped rows.
4. Confirm effective date and impact.
5. Apply and show audit result.

Preview rows should include:

- mortgage
- current active fees
- proposed applied fees
- configured value/rate
- effective date
- conflicts or overlaps
- whether the row will apply, skip, or require override

The write step must be idempotent and auditable.

## Payment Rails Integration

Borrower-payable fees must use universal payment rails.

The admin selects a supported inbound provider or payment rail. The system creates obligations and collection plan entries, then existing collection attempt and transfer infrastructure handles provider initiation and confirmation.

Payment rail compatibility is validated before write. Unsupported provider/behavior combinations are rejected with a specific error.

Future-payment waterfall deductions integrate with settlement and dispersal. They must not create extra borrower collections. They affect lender-distributable cash only after borrower cash has settled.

## Cash Ledger Traceability

Every applied fee must be traceable through the cash ledger.

For borrower-payable fees, traceability runs:

`feeAssessment -> obligation -> collectionPlanEntry -> collectionAttempt -> transferRequest -> cash receipt journal entries -> revenue/receivable journal entries`

For waterfall deductions, traceability runs:

`feeAssessment -> dispersalCalculationRun -> waterfall fee entry -> settlement allocation posting group -> SERVICING_REVENUE or generalized fee revenue journal entry`

Cash ledger entries should include `feeAssessmentId` where schema allows. If direct fields are too invasive for the first phase, metadata must include the fee assessment id, mortgage fee id, behavior, fee code/name, and calculation inputs/outputs.

The implementation should prefer first-class `feeAssessmentId` fields on new fee-specific tables and query return shapes. Cash ledger journal entries may start with metadata-based traceability if adding a direct field would force a large unrelated migration, but the trace query must normalize both paths so admins see one consistent chain.

The trace query should present one coherent admin view across both behaviors.

## Defaulting and Origination

New mortgages receive the active default fee set unless the activation flow explicitly opts out or provides overrides.

This must be wired into:

- admin origination activation
- Velocity activation
- seed/demo paths where fee assumptions matter

Existing mortgages are unchanged until an admin explicitly applies a fee or bulk-applies a fee set.

## Error Handling

Validation should reject:

- missing behavior
- invalid calculation parameters for behavior
- invalid recurrence rules
- unsupported payment rail/provider for behavior
- overlapping active mortgage fees in the same conflict group
- effective end date before start date
- waterfall deduction configurations that can over-consume the settlement amount without an approved priority/receivable policy

Bulk apply should return a preview with:

- `willApply`
- `willSkip`
- `hasConflict`
- `requiresOverride`

Borrower-payable fee execution should expose partial progress clearly:

- configuration created
- obligation created
- collection plan entry created
- transfer initiated
- transfer confirmed
- provider failed

Future-payment deductions should never silently disappear. If a deduction cannot be applied, the trace should show whether it was skipped, deferred, rejected, or partially applied according to the configured policy.

## Permissions

Reads on active mortgage fees follow mortgage detail access.

Mutating fee definitions, fee sets, bulk apply, and mortgage fee overrides should require `admin:access` or a future explicit `fees:manage` permission.

Actions that initiate or alter payment rail execution should also respect payment operations authorization, currently represented by `payment:manage` in nearby admin UI.

## Testing

Required test coverage:

- migration of existing servicing, late fee, and NSF configuration into behavior-aware fee definitions
- fee definition CRUD validation
- fee set CRUD and default selection
- mortgage application conflict detection
- default fee-set attachment in admin origination
- default fee-set attachment in Velocity activation
- one-time borrower fee creation through obligation and collection plan paths
- recurring borrower fee occurrence generation
- payment rail/provider validation
- waterfall deduction calculation
- lender payout conservation when fees are deducted
- cash ledger journal entries with fee trace metadata
- fee trace query for mortgage detail and fee admin
- `/admin` fee income aggregation from ledger-recognized activity
- bulk preview idempotency
- bulk apply audit logs

## Implementation Notes

This design is intentionally a refactor of the existing fee system. Avoid creating a separate billing subsystem with separate fee definitions.

The likely implementation order is:

1. Add behavior-aware data model fields and migrations.
2. Add read/query contracts for fee definitions, sets, applications, assessments, and revenue summaries.
3. Build `/admin/fees` CRUD and mortgage detail `Fees` read surface.
4. Wire default fee sets into new mortgage activation paths.
5. Add borrower one-time fee application through existing payment rails.
6. Add recurring borrower fee generation.
7. Refactor waterfall deduction to support generalized payment deductions and fee assessments.
8. Add bulk apply preview/apply.
9. Add `/admin` fee income metrics.

Each phase must keep existing servicing fee behavior working.
