# Spec Audit: ENG-330 - Velocity package: establish schema, contract, and audit primitives

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against real base
- Last run: 2026-04-24T01:02:44Z
- Verdict: ready

## Findings
- No ENG-330 spec-compliance findings.

## Unresolved items
- No unresolved ENG-330 requirements.
- Residual repo-wide risk: `bun run test` still fails in unrelated existing suites outside this issue's touched files. Failures include auth architecture guard offenders, listing fixture/schema drift around required `marketplacePropertyType`, a CRM system adapter listing authorization expectation, the single paginate guard offender in `convex/renewals/internal.ts`, and one collection attempt reconciliation admin-role expectation.

## Coverage Summary
- SATISFIED: 13
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0
- OUT_OF_SCOPE: 2

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | schema | Add dedicated Velocity package tables and indexes for workspaces, snapshots, webhook events, sync attempts, activation attempts, exceptions, and document links. | `convex/schema.ts` | All seven tables are present with package lookup, status/result, idempotency, and relation indexes. |
| SATISFIED | contracts | Define shared Velocity enums, raw-envelope validators, normalized core DTOs, FairLend enrichment DTOs, readiness/exception types, and `VelocityActivationHandoffV1`. | `convex/velocity/constants.ts`, `convex/velocity/contracts.ts`, `convex/velocity/validators.ts` | Raw provider payload remains permissive; normalized/readiness contracts are structured. |
| SATISFIED | namespace | Downstream slices can import stable DTOs, constants, readiness/exception enums, and validators from one Velocity namespace. | `convex/velocity/index.ts`, `convex/_generated/api.d.ts` | Barrel has an explicit Biome exception because this namespace is the intended contract boundary. |
| SATISFIED | status semantics | Only `Funded (6)` enables activation; `Complete (7)` routes to remediation; Parked/Cancelled/Declined are non-actionable raw statuses. | `resolveVelocityStatusSemantics`, `src/test/convex/velocity/contracts.test.ts` | No new persisted states were invented for Parked/Cancelled/Declined. |
| SATISFIED | remediation | Activation remediation explicitly models `loanType` and `lienPosition`. | `VelocityActivationRemediationV1`, `VelocityActivationHandoffV1`, `velocityActivationRemediationValidator` | Extensible via broker, borrower role, notes, and policy input fields. |
| SATISFIED | provenance | Velocity-specific workflow source type/key builders and canonical mortgage/borrower provenance helpers exist. | `convex/velocity/provenance.ts`, `buildVelocityMortgageWorkflowSourceKey` | Mortgage activation handoff carries Velocity workflow source metadata. |
| SATISFIED | idempotency | Webhook, sync, and activation idempotency key helpers are defined. | `buildVelocityWebhookEventIdempotencyKey`, `buildVelocitySyncIdempotencyKey`, `buildVelocityActivationIdempotencyKey` | Sync/activation tables include idempotency key indexes. |
| SATISFIED | audit | Velocity audit helper writes through the shared append-only audit pipeline and preserves webhook agent/credential scope. | `convex/velocity/audit.ts`, `convex/engine/types.ts`, `convex/engine/validators.ts` | `appendAuditJournalEntry` was not modified due CRITICAL blast radius. |
| SATISFIED | documents | Package document links are keyed to existing `documentAssets`. | `velocityPackageDocumentLinks`, `VelocityFairLendEnrichmentV1.padEvidence` | No parallel file-store contract was introduced. |
| SATISFIED | endpoint boundary | No raw exported Convex pseudo-endpoints were added. | `convex/velocity/*` | New exports are shared modules/helpers/types/validators, not Convex endpoint exports. |
| SATISFIED | validation | Required schema/codegen/type gates pass. | `bunx convex codegen`, `bun check`, `bun typecheck` | `bun check` reports existing complexity warnings but exits 0. |
| SATISFIED | tests | Focused unit tests cover Velocity constants, status semantics, idempotency builders, provenance, namespace stability, and record contract/schema assumptions. | `src/test/convex/velocity/contracts.test.ts` | 7 tests pass. |
| SATISFIED | GitNexus | Impact analysis was run before existing-symbol edits and change scope was inspected before closeout. | `npx gitnexus impact`, `npx gitnexus status`, `git status --short` | `gitnexus_detect_changes` was not available via MCP or CLI, so fallback scope verification was recorded. |
| OUT_OF_SCOPE | e2e | Add e2e coverage. | Execution checklist | ENG-330 adds backend schema/contract primitives only, with no user/operator workflow. |
| OUT_OF_SCOPE | Storybook | Add Storybook stories. | Execution checklist | ENG-330 adds no UI components or screens. |

## Validation Evidence
- `bunx convex codegen`: passed.
- `bun check`: passed; existing cognitive-complexity warnings remain outside ENG-330.
- `bun typecheck`: passed.
- `bun run test src/test/convex/velocity/contracts.test.ts`: passed, 7 tests.
- `bun run test`: failed in unrelated existing suites; no failure references the new Velocity package files.
