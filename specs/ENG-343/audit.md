# Spec Audit: ENG-343 - Deal closing: harden funds confirmation and close-side effects

- Audit skill: `$linear-pr-spec-audit`
- Review target: local branch diff for Linear ENG-343
- Last run: 2026-04-24T17:59:53-04:00
- Verdict: ready

## Findings
- none

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
| SATISFIED | lifecycle | Replace `confirmFundsReceipt` stub with evidence validation and durable recording. | `convex/engine/effects/dealClosingEffects.ts` | Resolves payload/fallback evidence, records successes, replays, blockers, and validation failures. |
| SATISFIED | auth | Manual confirmation requires FairLend admin path and auditable actor/timestamp/note/attachments. | `convex/deals/mutations.ts` | Uses `adminMutation`, validates deal state and evidence, then emits governed `FUNDS_RECEIVED`. |
| SATISFIED | integration | Provider-backed `FUNDS_RECEIVED` is tied to same-deal confirmed leg 2 seller payout evidence. | `convex/engine/effects/transfer.ts`, `convex/deals/closeEvidence.ts` | Leg 2 payload carries source; validator checks deal, pipeline, transfer type, leg, status, and provider. |
| SATISFIED | safety | Missing, mismatched, incompatible duplicate, cancelled/failed/non-confirmed evidence fails safely. | `convex/engine/effects/dealClosingEffects.ts`, `convex/deals/closeEvidence.ts`, `convex/deals/__tests__/closeEvidence.test.ts` | Missing evidence records blocker; invalid provider evidence records failed outcome; duplicate incompatible evidence is blocked. |
| SATISFIED | archive | Replace `archiveSignedDocuments` stub with ENG-342 signed artifact archive handling. | `convex/engine/effects/dealClosingEffects.ts`, `convex/deals/closeEvidence.ts` | Archives active completed envelope artifacts or records a missing-artifacts blocker. |
| SATISFIED | outcomes | Record close-side effect outcomes for reservation commit, proration, reroute, and lawyer access cleanup. | `convex/engine/effects/dealClosing.ts`, `convex/engine/effects/dealClosingProrate.ts`, `convex/engine/effects/dealClosingPayments.ts`, `convex/engine/effects/dealAccess.ts` | Existing idempotency behavior is preserved while adding observable outcomes. |
| SATISFIED | projections | Expose admin/internal close evidence and participant-safe close receipt. | `convex/deals/queries.ts` | Admin projection includes operational detail; participant receipt excludes manual notes and attachments. |
| SATISFIED | tests | Add targeted Convex coverage and keep adjacent close/transfer suites passing. | `convex/deals/__tests__/closeEvidence.test.ts`; validation log in chunk status files | Focused tests cover manual/provider evidence, replay, incompatible duplicates, missing evidence, cancelled provider evidence, archive blockers/success, and projections. |
| SATISFIED | validation | Run required gates. | `specs/ENG-343/chunks/chunk-05-validation-audit/status.md` | `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests, full test suite, and review script passed. |

## Unresolved items
- none

## Review Notes
- `bun run review` reported six findings. Two scoped ENG-343 items were fixed: the hardcoded artifact path and manual `receivedAt` error message. The remaining findings are in unrelated existing/prior-branch files and were not changed as part of ENG-343.

## Next action
- Run final execution artifact validation and GitNexus change detection.
