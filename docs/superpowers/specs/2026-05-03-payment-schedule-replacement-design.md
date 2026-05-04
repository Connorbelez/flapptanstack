# Admin Payment Schedule Replacement Design

## Purpose

The admin payment operations screen needs a safe workflow for replacing the remaining payment schedule for a mortgage. The workflow creates a non-destructive draft, previews the full historical and replacement schedule, and only mutates production records when an admin explicitly applies the draft.

The replacement schedule must fully pay off the mortgage. The last generated row is always a manual principal payoff collection. The final payoff date must be no later than two calendar months after the mortgage `maturityDate`.

## Scope

In scope:

- Mortgage-level replacement action from `/admin/payment-operations`.
- Replacement rails split into app-managed manual collection and provider-managed Rotessa PAD.
- Backend-owned schedule generation and validation.
- Constrained start date, payment frequency, and amount controls.
- Read-only historical settled obligation context in the preview.
- Replacement of unpaid/non-settled obligations and unexecuted collection plan rows only.
- App-managed per-row date adjustment after preview generation.
- Provider-managed Rotessa cancellation/deactivation of the previous provider schedule before replacement activation.
- New PAD upload requirement for provider-managed Rotessa replacement.
- Audit lineage from old rows to draft and from old rows to the activated replacement batch.

Out of scope:

- Editing individual provider-managed occurrence dates.
- PAD admin override in this replacement workflow.
- A full migration to canonical schedule-version aggregates across all payment tables.
- Changing settled historical obligations.

## Key Decisions

- The deadline is `mortgage.maturityDate + 2 calendar months`, not the original closing date.
- Preview generation is non-destructive.
- Apply is the only destructive/mutating step.
- App-managed row date edits update both generated obligation `dueDate` and generated collection plan `scheduledDate`.
- Provider-managed replacement dates are cadence-driven and not individually editable.
- Provider-managed Rotessa schedules include only the recurring interest-only rows. The final principal payoff is always an app-managed manual collection plan entry.
- The admin chooses start date and frequency first. The backend returns a constrained amount slider range for that start/frequency pair so invalid payoff combinations cannot be selected.
- The final manual principal payoff is auto-placed on the next cadence date after the final interest-only row.

## Architecture

Add a first-class `paymentScheduleReplacementDrafts` workflow owned by the payment operations domain.

The backend owns schedule math and validation. A draft stores the selected mortgage, rail choice, constrained inputs, generated preview rows, optional app-managed date overrides, Rotessa PAD asset, status, and audit metadata. Preview is non-destructive. Applying the draft is the only mutating step.

On apply:

1. Re-validate the draft against current mortgage state.
2. Cancel/archive existing unpaid obligations and unexecuted plan entries with lineage to the draft.
3. If the old schedule is provider-managed, cancel/delete the active Rotessa schedule before activating the replacement.
4. Create replacement interest-only obligations and plan entries.
5. Create the final `principal_repayment` obligation and manual plan entry on the next cadence date.
6. If replacement rail is Rotessa, create the provider schedule for only the interest-only entries.
7. Mark the draft activated and patch archived rows with lineage to the new production replacement batch/schedule.

The apply operation should be idempotent around a generated `replacementBatchId`. Retrying an activation should not duplicate production obligations, collection plan entries, or provider schedules.

## Data Model

Add `paymentScheduleReplacementDrafts`:

- `mortgageId`
- `status`: `draft`, `ready`, `activating`, `activated`, `activation_failed`, `cancelled`
- `replacementRail`: `app_managed_manual`, `provider_managed_rotessa`
- `startDate`
- `paymentFrequency`: `monthly`, `bi_weekly`, `accelerated_bi_weekly`, `weekly`
- `interestPaymentAmount`
- `outstandingInterestAmount`
- `principalPayoffAmount`
- `interestInstallmentCount`
- `finalPayoffDate`
- `deadlineDate`
- `previewRows`
- `dateOverrides`
- `bankAccountId`
- `padAuthorizationAssetId`
- `replacementBatchId`
- `newExternalCollectionScheduleId`
- `archivedExternalCollectionScheduleId`
- `activatedAt`
- `lastError`
- actor and timestamp fields

Add minimal lineage fields to `obligations` and `collectionPlanEntries`:

- `replacementDraftId`
- `replacementBatchId`
- `replacedByReplacementBatchId`
- `archivedByReplacementDraftId`
- `archivedByReplacementBatchId`
- `archivedAt`
- `archiveReason`

For new active records, `replacementBatchId` ties the replacement set together. For archived old records, draft lineage is set before activation, then batch lineage is patched after activation succeeds.

If a full schedule aggregate becomes desirable later, these lineage fields can be folded into a `mortgagePaymentSchedules` version model without changing the admin workflow semantics.

## Amount Sources

`outstandingInterestAmount` is the sum of unpaid `regular_interest` obligation balances for the mortgage:

```ts
amount - amountSettled
```

Rows with no outstanding balance are historical context only. Rows with active/executing collection attempts block apply until the execution state resolves.

`principalPayoffAmount` is computed by a dedicated helper. For the current model, it is:

```ts
mortgage.principal - settledPrincipalRepaymentAmount
```

where `settledPrincipalRepaymentAmount` is the sum of settled amounts on existing `principal_repayment` obligations for the mortgage. The value is clamped to zero. If a stronger principal-balance ledger source exists by implementation time, the helper can switch to that source while preserving the API contract.

## Schedule Generation

Inputs:

- `mortgageId`
- replacement rail
- `startDate`
- `paymentFrequency`
- `interestPaymentAmount`
- optional Rotessa `bankAccountId`
- optional Rotessa `padAuthorizationAssetId`

Derived values:

- `deadlineDate = addCalendarMonths(mortgage.maturityDate, 2)`
- cadence dates from `startDate` using the selected frequency
- `interestInstallmentCount`
- `finalPayoffDate`
- slider constraints for valid interest payment amounts

For a selected start date and frequency, the backend computes the maximum number of cadence dates that can fit on or before `deadlineDate`. One cadence date is reserved for the final principal payoff. The remaining cadence dates are available for interest-only rows.

The valid amount slider range is:

```ts
minInterestPaymentAmount = ceil(outstandingInterestAmount / maxInterestRows)
maxInterestPaymentAmount = outstandingInterestAmount
```

If `maxInterestRows < 1`, the start date/frequency pair is invalid because there is no room for both interest collection and final principal payoff. Amounts are stored in cents. The frontend can use a display-friendly slider step returned by the backend, but the backend still validates the selected cent amount exactly.

Generation rules:

- Interest-only rows allocate `outstandingInterestAmount`.
- Each interest row uses the selected amount, except the final interest row may be smaller.
- The final principal payoff row is placed on the next cadence date after the final interest row.
- The final principal payoff row must be on or before `deadlineDate`.
- Provider-managed Rotessa receives only the interest-only rows.
- The final principal payoff row always creates a manual app-managed collection plan entry.
- If no valid schedule exists for the selected start date and frequency, the backend returns validation errors and disables the amount slider/apply action.

## UI Flow

The selected mortgage schedule detail rail gets a `Replace schedule` action.

The replacement workspace is a focused drawer or dialog:

1. Mortgage context
   Shows borrower, current rail, maturity date, max payoff deadline, unpaid interest total, and principal payoff amount.
2. Rail selection
   Splits choices into app-managed manual collection and provider-managed Rotessa PAD.
3. Cadence controls
   Uses a constrained date picker for `startDate`, fixed options for `paymentFrequency`, and a slider for `interestPaymentAmount`. The amount slider range and step come from the backend.
4. Preview
   Shows settled historical rows as read-only context, then generated replacement interest-only rows and the final manual principal payoff row.
5. App-managed date adjustments
   App-managed generated rows expose constrained date pickers after preview generation. Edits update both obligation due date and collection plan date in the draft. Provider-managed rows do not expose date editing.
6. Rotessa requirements
   Provider-managed replacement requires eligible borrower bank account selection plus a new signed PAD PDF upload before apply.
7. Apply
   The final button summarizes destructive effects: archive old unpaid schedule rows, cancel old Rotessa schedule if present, and activate the replacement.

The UI must not expose plain text inputs for the interdependent schedule controls. Start date, frequency, and amount must be constrained controls whose options are driven by backend validation.

## Backend API

Expose a replacement workspace API from the payment operations domain:

- `getScheduleReplacementContext(mortgageId)`
  - Loads mortgage facts, settled history, unpaid obligations, unexecuted plan entries, current external schedule, borrower, eligible bank accounts, and max deadline.
- `createOrUpdateScheduleReplacementDraft(input)`
  - Stores selected rail, start date, frequency, amount, bank account, PAD asset, and regenerated preview.
- `getScheduleReplacementDraft(draftId)`
  - Returns current draft, validation state, slider constraints, and preview rows.
- `adjustDraftRowDate(input)`
  - App-managed only. Updates generated obligation due date and collection plan scheduled date in preview data.
- `applyScheduleReplacementDraft(draftId)`
  - Performs the destructive transition and provider work.

The preview and apply paths must share the same schedule generator module so the UI cannot preview one result and apply another.

## Apply Semantics

Before mutation, the backend re-checks:

- mortgage still exists
- no newer replacement has already activated for the same mortgage
- selected start/frequency/amount still fit within `maturityDate + 2 months`
- target old rows are still unpaid/non-settled or unexecuted and have no unsafe execution state
- app-managed date overrides still fit within the cap
- Rotessa replacement has an eligible borrower-owned bank account and uploaded PAD
- old Rotessa schedule can be cancelled when one is active

For app-managed replacement:

1. Mark draft `activating`.
2. Archive target old unpaid obligations and plan entries with draft lineage.
3. Create new interest obligations and manual plan entries.
4. Create final principal payoff obligation and manual plan entry.
5. Patch archived old rows with replacement batch lineage.
6. Mark draft `activated`.

App-managed date overrides must keep generated rows in strictly increasing order. Each editable row date picker is constrained to be after the previous generated row date and before the next generated row date. The final principal payoff row can never move later than `deadlineDate`.

For provider-managed Rotessa replacement:

1. Mark draft `activating`.
2. Cancel/delete old active Rotessa schedule first.
3. Mark the old local `externalCollectionSchedules` row terminal/cancelled.
4. Archive target old unpaid obligations and plan entries with draft lineage.
5. Create the new Rotessa provider schedule for interest-only entries from the draft preview.
6. Create new interest obligations and provider-managed plan entries.
7. Create final principal payoff obligation and manual plan entry.
8. Commit the interest entries to provider-managed status.
9. Patch archived old rows with replacement batch lineage.
10. Mark draft `activated`.

The old provider schedule must not remain live alongside the new schedule. If old provider cancellation fails, production rows are not archived and the draft remains retryable.

If old provider cancellation succeeds but new provider creation fails, the draft becomes `activation_failed`. The old local schedule is terminal/cancelled, the archived old rows are non-executable, the replacement remains retryable, and the UI surfaces remediation clearly. If new provider creation succeeds but the local commit fails, the action must attempt to cancel the newly created provider schedule and record any compensation failure on the draft.

## Error Handling And Audit

Every validation rejection returns actionable error codes and messages.

Every activation attempt writes audit events with:

- draft id
- replacement batch id when available
- old external schedule id
- new external schedule id when available
- old obligation and plan entry ids
- actor id
- action timestamp
- provider error details when relevant
- validation failure codes

The draft status model must make retries explicit:

- `draft`: editable, not yet valid
- `ready`: valid and applyable
- `activating`: apply in progress
- `activated`: production replacement created
- `activation_failed`: retryable failure with `lastError`
- `cancelled`: abandoned draft

## Frontend Integration

Integrate into the existing payment operations screen rather than creating a separate admin route for v1.

Expected component boundaries:

- Mortgage schedule detail action in `PaymentOperationsPage`.
- `ScheduleReplacementDialog` for the workspace.
- `ScheduleReplacementControls` for rail, start date, frequency, and amount.
- `ScheduleReplacementPreviewTable` for historical context and generated rows.
- `ScheduleReplacementPadUpload` reusing the canonical document asset upload helpers.

The route already has payment operations data loaded through Convex/TanStack Query. The replacement dialog should use focused Convex queries/actions rather than bloating the dashboard snapshot.

## Testing

Backend tests:

- Preview math for monthly, bi-weekly, accelerated bi-weekly, and weekly schedules.
- Deadline cap at `maturityDate + 2 months`.
- Slider constraints never allow invalid amounts.
- Final principal payoff row is always manual and on the next cadence date.
- App-managed date override updates both due date and collection scheduled date.
- Provider-managed rejects per-row date edits.
- Provider-managed requires a new PAD upload.
- Applying archives only unpaid/non-settled rows and preserves settled history.
- Rotessa old schedule cancellation happens before new schedule creation.
- Activation failure states for validation failure, old provider cancellation failure, and new provider creation failure.
- Audit lineage from old rows to draft, then to replacement batch/schedule.

Frontend tests:

- `Replace schedule` action appears at mortgage schedule level.
- Rail selection changes required fields.
- Start date/frequency constrain the amount slider.
- Preview displays settled context and generated replacement rows distinctly.
- App-managed rows expose date pickers.
- Provider-managed rows do not expose date pickers.
- Apply button is disabled until draft is valid.
- Apply button remains disabled for Rotessa until a new PAD asset exists.

Validation gate:

- `bun check`
- `bun typecheck`
- `bunx convex codegen`
