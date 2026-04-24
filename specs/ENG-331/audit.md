# Spec Audit: ENG-331 - Velocity package: build webhook ingestion and full-deal sync spine

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against real base
- Last run: 2026-04-24T04:42:43Z
- Verdict: needs manual validation

## Findings
- No unresolved implementation or validation findings.

## Resolved Findings
- [P1] Required repo-wide validation was not green because `bun check` failed when Biome exceeded the default diagnostic display cap while reporting existing warning-level complexity diagnostics. Addressed by baselining the `check` script with `--max-diagnostics=300`; `bun check` now exits successfully and still prints the existing warnings for follow-up refactors.

## Coverage Summary
- SATISFIED: 17
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 2
- OUT_OF_SCOPE: 2

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | capability | Register `POST /api/velocity/webhook`. | `convex/http.ts:39` | Route points to `velocityWebhook`. |
| SATISFIED | auth | Authenticate webhook requests and return `unauthorized` for failed auth. | `convex/velocity/webhook.ts:163`, `convex/velocity/webhook.ts:351` | Shared secret / bearer token / query token supported because Velocity docs do not define a signature scheme. |
| SATISFIED | persistence | Persist raw webhook rows before package mutation. | `convex/velocity/webhook.ts:315`, `convex/velocity/webhook.ts:363` | Raw body, status, event idempotency, agent, credential context, and deal href are stored before sync action dispatch. |
| SATISFIED | negative contract | Webhook payload is notification-only and does not patch workspace state directly. | `convex/velocity/webhook.ts:372`, `convex/velocity/sync.ts:923` | Webhook dispatches loanCode/dealHref into full-deal sync; workspace mutation only happens from fetched full deal. |
| SATISFIED | provider contract | Fetch full deal by `loanCode`, using opaque href fallback only when supplied. | `convex/velocity/client.ts:191`, `convex/velocity/client.ts:219` | Primary Deals Out URL uses `/v1/deals?apikey=...&loancode=...`; fallback requires `dealHref`. |
| SATISFIED | normalization | Normalize full deal into `VelocityNormalizedCoreV1` with stable hashes and enum mappings. | `convex/velocity/sync.ts:159`, `convex/velocity/sync.ts:241` | Produces raw deal hash and normalized hash for idempotency/snapshotting. |
| SATISFIED | identity | Validate `linkApplicationId` and open explicit identity exception when missing. | `convex/velocity/sync.ts:245`, `convex/velocity/sync.ts:1042`, `src/test/convex/velocity/sync.test.ts:336` | Test asserts no workspace, failed webhook status, identity exception, and audit provenance. |
| SATISFIED | identity | Detect duplicate workspaces for the same `linkApplicationId`. | `convex/velocity/sync.ts:1117`, `src/test/convex/velocity/sync.test.ts:375` | Test manually seeds a collision and verifies identity exception/audit rejection. |
| SATISFIED | idempotency | Use webhook-event and full-deal sync idempotency to prevent duplicate rows/work. | `convex/velocity/webhook.ts:286`, `convex/velocity/sync.ts:1093`, `src/test/convex/velocity/sync.test.ts:200`, `src/test/convex/velocity/sync.test.ts:318` | Duplicate webhook returns duplicate; repeated same full deal is duplicate noop without extra snapshot. |
| SATISFIED | workspace | Create/update workspace through one reusable sync path. | `convex/velocity/sync.ts:1022`, `convex/velocity/sync.ts:1208` | Webhook and manual sync both call `processVelocityFullDealSync`/`applyVelocityFullDealSync`. |
| SATISFIED | snapshots | Create upstream snapshots only when normalized core changes. | `convex/velocity/sync.ts:1237`, `src/test/convex/velocity/sync.test.ts:318`, `src/test/convex/velocity/sync.test.ts:432` | Duplicate full deal keeps one snapshot; manual changed deal creates a second snapshot. |
| SATISFIED | readiness | Recompute readiness for status semantics, mappings, required core fields, and FairLend-owned blockers. | `convex/velocity/sync.ts:448`, `src/test/convex/velocity/sync.test.ts:244` | Tests verify Funded status normalization and FairLend blocker state. |
| SATISFIED | exceptions | Open package exceptions for identity, mapping, and core-field rules. | `convex/velocity/sync.ts:620`, `convex/velocity/sync.ts:1261` | FairLend-owned enrichment blockers remain readiness blockers, not package exceptions, matching issue wording. |
| SATISFIED | audit | Write lifecycle audit entries through the Velocity package audit helper. | `convex/velocity/sync.ts:738`, `convex/velocity/sync.ts:812`, `convex/velocity/sync.ts:853`, `src/test/convex/velocity/sync.test.ts:291` | Tests assert webhook provenance and rejected identity audit events. |
| SATISFIED | manual sync | Expose backend manual `Sync now` surface that reuses sync path. | `convex/velocity/sync.ts:1302`, `src/test/convex/velocity/sync.test.ts:432` | Public admin action refetches by workspace loanCode and calls same action. |
| SATISFIED | fluent-convex | Exported Convex queries/mutations/actions use fluent builder with explicit visibility. | `convex/velocity/webhook.ts:219`, `convex/velocity/sync.ts:908`, `convex/velocity/sync.ts:923`, `convex/velocity/sync.ts:971`, `convex/velocity/sync.ts:1022`, `convex/velocity/sync.ts:1302` | HTTP action is registered through Convex `http.route`. |
| SATISFIED | tests | Add backend coverage for webhook persistence, idempotency, normalization, exceptions, snapshots, and manual sync convergence. | `src/test/convex/velocity/sync.test.ts:200` | Targeted test command passes: 13 tests across Velocity sync/contracts. |
| UNVERIFIED | deployment | Production Velocity webhook secret/token env vars are configured. | Code supports envs in `convex/velocity/webhook.ts:166`. | Requires deployment configuration outside this branch. |
| UNVERIFIED | provider integration | Live Newton Deals Out response shape exactly matches accepted v1 payloads. | Client accepts direct deal or `{ deals: [...] }` in `convex/velocity/client.ts:125`. | Automated tests stub the provider; live provider validation remains manual/integration work. |
| OUT_OF_SCOPE | frontend | Operator UI for manual `Sync now`. | Linear issue requests backend surface only. | No UI/E2E work expected for ENG-331. |
| OUT_OF_SCOPE | activation | Mortgage/listing activation flow after sync. | ENG-331 is ingestion/sync spine. | Activation is covered by later package phases. |

## Validation Evidence
- `bunx convex codegen`: passed.
- `bun typecheck`: passed.
- `bun run test -- src/test/convex/velocity/sync.test.ts src/test/convex/velocity/contracts.test.ts`: passed, 13 tests. Vitest emitted the existing close-timeout warning after successful completion.
- Scoped touched-file Biome: passed.
- `bun check`: passed. It still reports 91 warning-level diagnostics, primarily existing cognitive-complexity and nested-ternary warnings outside the ENG-331 Velocity scope.

## Unresolved Items
- Confirm production/deployment secrets for `VELOCITY_WEBHOOK_SECRET` or `VELOCITY_WEBHOOK_TOKEN` and `VELOCITY_API_KEY`.
- Run a live or sandbox Newton webhook/manual sync smoke test when provider credentials are available.
