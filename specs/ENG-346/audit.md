# Spec Audit: ENG-346 - Deal closing: upgrade admin operations console

- Audit skill: `$linear-pr-spec-audit`
- Review target: local branch diff against current worktree base
- Last run: 2026-04-28T19:56:44Z
- Verdict: needs manual validation

## Findings
- [SATISFIED] Focused Convex projection tests were added. `convex-test` coverage now exercises missing mortgage visibility, unknown upstream status handling, and server-projected governed actions for `getAdminDealOperations` / `getAdminDealOperationsDetail`.
- [UNVERIFIED] Admin denial-path and full e2e validation are not executed. The route and backend continue to use the existing admin route and `adminQuery` gates, and the e2e spec has been updated for the new pipeline/console flow, but `bun run test:e2e -- --project=deal-closing` cannot run without `TEST_ACCOUNT_EMAIL`.
- [SATISFIED] Admin signing-token leakage is avoided in the implemented UI and tests. The console renders recipient status/role/provider metadata without signing sessions or token values, and component coverage asserts no `token_` value is exposed.
- [SATISFIED] Payload-required cancellation is gated. The action dialog keeps the submit button disabled until a non-empty reason is present and submits `DEAL_CANCELLED` through `transitionDeal`.
- [SATISFIED] The old generic `/admin/deals` and `/admin/deals/$recordid` experiences are replaced with a phase pipeline and dedicated operations console grounded in the current ENG-338/ENG-342/ENG-343 modules already present in the repo.

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | frontend | `/admin/deals` opens to phase-grouped operations pipeline with filters | `src/routes/admin/deals/route.tsx`, `src/components/admin/deals/DealOperationsPipeline.tsx` | Uses server-projected phase/filter metadata. |
| SATISFIED | frontend | `/admin/deals/$recordid` opens dedicated operations console | `src/routes/admin/deals/$recordid.tsx`, `src/components/admin/deals/DealOperationsConsole.tsx` | Includes lifecycle, package/signers, parties/access, financials, blockers, audit, and portal links. |
| SATISFIED | backend | Convex projection composes ENG-338/342/343 surfaces | `convex/deals/queries.ts` | Reads participant projection, document package surface, close evidence, deal access, signing recipients, and audit events. |
| SATISFIED | lifecycle | Actions use governed transitions/subordinate actions only | `src/components/admin/deals/DealOperationActionControls.tsx` | Uses `transitionDeal` and `confirmManualFundsReceipt`; no direct status patching in UI. |
| SATISFIED | lifecycle | Cancellation requires reason and uses `DEAL_CANCELLED` | `src/components/admin/deals/DealOperationActionControls.tsx`, `src/test/admin/deal-operations-components.test.tsx` | Covered by payload-disabled component test. |
| SATISFIED | security | Admin UI does not expose participant-only signing tokens | `src/components/admin/deals/DealOperationsConsole.tsx`, `src/test/admin/deal-operations-components.test.tsx` | Recipient roster excludes token/session fields. |
| PARTIAL | tests | Focused query, view-model, component, route/integration, and e2e coverage | `convex/deals/__tests__/adminOperations.test.ts`, `src/test/admin/deal-operations-view-model.test.ts`, `src/test/admin/deal-operations-components.test.tsx`, `e2e/deal-closing/kanban.spec.ts` | Direct Convex projection tests were added; e2e is updated but not executable in this environment. |
| UNVERIFIED | auth | Non-admin and external-org admin denial paths covered | Existing admin route/backend gates remain in use | Denial behavior needs e2e/auth test environment. |
| PARTIAL | validation | Required repo gates pass before completion | local command output | `bun check`, `bun typecheck`, codegen, and targeted tests pass; full test/e2e/review remain blocked as recorded. |

## Unresolved items
- Run deal-closing e2e with a configured admin test account and verify non-admin/external-org denial paths.
- Re-run full `bun run test` after unrelated suite failures are addressed or isolated.
- Re-run `bun run review` on a review target under CodeRabbit's file-count limit.
- Broaden direct Convex projection tests for full participant/access/signing/close-evidence/audit composition if strict spec audit closure requires more backend-only assertions.

## Next action
- Treat the implementation as functionally built with review findings addressed, but not merge-ready until the unresolved environment/suite validation items above are closed.
