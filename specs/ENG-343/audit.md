# Spec Audit: ENG-343 - Deal closing: harden funds confirmation and close-side effects

- Audit skill: `$linear-pr-spec-audit`
- Review target: PR #516 / local branch `eng-343-harden-close-side-effects` against base `eng-342-deal-closing`
- Last run: 2026-04-25T10:13:00-04:00
- Verdict: ready

## Findings
- None.

## Coverage Summary
- SATISFIED: 11
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | contract | Define `FundsReceiptSource` for transfer-pipeline and manual-admin evidence. | `convex/deals/closeEvidence.ts` | Includes pipeline id, leg 2 transfer id, provider code, admin actor, note, received timestamp, and attachment ids. |
| SATISFIED | data model | Persist funds evidence, signed archives, and close effect outcomes with idempotency keys. | `convex/schema.ts`, `convex/deals/closeEvidence.ts` | Adds indexed tables and deterministic idempotency helpers. |
| SATISFIED | lifecycle | Missing or invalid `FUNDS_RECEIVED` evidence must reject or safely exception processing before close advancement. | `convex/deals/mutations.ts`, `convex/payments/transfers/mutations.ts`, `convex/deals/closeEvidence.ts` | Admin and internal pipeline `FUNDS_RECEIVED` entrypoints now synchronously record/validate evidence before `executeTransition`; missing, incompatible, or invalid evidence throws before the governed state change. The scheduled `confirmFundsReceipt` effect remains an idempotent replay/backstop. |
| SATISFIED | auth | Manual confirmation requires FairLend admin path and auditable actor/timestamp/note/attachments. | `convex/fluent.ts`, `convex/deals/mutations.ts` | `adminMutation` uses `requireFairLendAdmin`; manual mutation validates state and evidence. |
| SATISFIED | integration | Provider-backed `FUNDS_RECEIVED` carries same-deal leg 2 seller payout evidence. | `convex/engine/effects/transfer.ts`, `convex/deals/closeEvidence.ts` | Leg 2 payload carries source; validator checks deal, pipeline, transfer type, leg, status, and provider. |
| SATISFIED | archive | Replace `archiveSignedDocuments` stub with ENG-342 signed artifact archive handling. | `convex/engine/effects/dealClosingEffects.ts`, `convex/deals/closeEvidence.ts` | Archives active completed envelope artifacts or records a missing-artifacts blocker. |
| SATISFIED | outcomes | Record close-side effect outcomes for reservation commit, proration, reroute, and lawyer access cleanup. | `convex/engine/effects/dealClosing.ts`, `convex/engine/effects/dealClosingProrate.ts`, `convex/engine/effects/dealClosingPayments.ts`, `convex/engine/effects/dealAccess.ts` | Existing idempotency behavior is preserved while adding observable outcomes. |
| SATISFIED | projections | Expose admin/internal close evidence and participant-safe close receipt. | `convex/deals/queries.ts` | Admin projection includes operational detail; participant receipt excludes manual notes and attachments. |
| SATISFIED | tests | Add targeted Convex coverage and keep adjacent close/transfer suites passing. | `convex/deals/__tests__/closeEvidence.test.ts`; validation commands below | Regression tests prove missing admin evidence and invalid system provider evidence reject before the deal leaves `fundsTransfer.pending` and before funds evidence rows are inserted. |
| SATISFIED | validation | Run required gates. | `specs/ENG-343/chunks/chunk-05-validation-audit/status.md` | Recorded codegen, check, typecheck, targeted tests, full test suite, and review script. |
| SATISFIED | scope guardrails | Do not redesign payment providers, document management, portal UI, or deal machine topology. | PR #516 file list | Scope stays backend hardening/projection/test focused. |

## Unresolved items
- None.

## Review Notes
- Linear source: ENG-343 requirements 3, 4, 6, and Definition of Done require evidence-backed `FUNDS_RECEIVED` and cancelled/failed/missing-evidence protection.
- PR source: #516, local branch `eng-343-harden-close-side-effects`.
- Follow-up finding addressed by moving funds evidence validation into the admin/system transition entrypoints before `executeTransition`.

## Validation
- PASS: `bun check` (exit 0; repo still reports warning-level pre-existing complexity/style diagnostics).
- PASS: `bun typecheck`.
- PASS: `bunx convex codegen`.
- PASS: `bun run test convex/deals/__tests__/closeEvidence.test.ts convex/deals/__tests__/effects.test.ts convex/deals/__tests__/dealClosing.test.ts convex/payments/transfers/__tests__/outboundFlow.integration.test.ts convex/machines/__tests__/deal.integration.test.ts` (46 passed, 12 skipped; Vitest reported a non-failing close timeout after successful test completion).
