# Spec Audit: ENG-342 - Deal closing: add envelope attempts, webhooks, and signing exceptions

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against the worktree base
- Last run: 2026-04-24T20:28:00Z
- Verdict: not ready

## Findings
- [P1] Required completion gate `bun run test` is not green. The ENG-342 targeted envelope/package tests pass, but the full suite fails 26 existing tests outside the envelope path, including CRM/listing fixture schema failures for `marketplacePropertyType`, existing auth architecture guard failures, React invalid-hook failures in listing/admin route tests, and a transfer reconciliation FairLend admin auth failure. This violates the issue Definition of Done command gate even though the failures are not caused by the changed envelope modules.
- [P1] Required completion gate `bun run review` is blocked before review starts. CodeRabbit reports the branch contains 952 files, 652 over its 300-file limit, so the automated review gate cannot complete for the current branch target.

## Unresolved items
- Full repo test gate remains blocked by failures outside the ENG-342 implementation path.
- CodeRabbit review gate remains blocked by branch-size limits outside the ENG-342 implementation diff.
- Live Documenso delivery remains a manual/provider-environment checkpoint; local tests cover signature verification, normalized event persistence, dedupe, recipient progress, exceptions, reissue lineage, and completion gating with mocked provider events.

## Coverage Summary
- SATISFIED: 18
- PARTIAL: 2
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 1

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | data model | Add envelope attempt validators/schema with deal/package/instance/generated doc/provider ids, status, roster, active/superseded lineage, terminal fields, timestamps. | `convex/documents/contracts.ts`, `convex/schema.ts` | Includes `dealEnvelopeAttempts` indexes and generated API refresh. |
| SATISFIED | data model | Add recipient progress validators/schema with platform role, Documenso role, order, required/completion state, provider recipient id, embedded token fields, statuses, rejection reason, timestamps. | `convex/documents/contracts.ts`, `convex/schema.ts` | Covered by attempt creation and projection tests. |
| SATISFIED | data model | Add signing exception schema/projection for config, send, stall, rejection, void/cancel, reconciliation mismatch. | `convex/documents/contracts.ts`, `convex/schema.ts`, `convex/deals/envelopes.ts`, `convex/deals/envelopeWebhooks.ts` | Stall/send failure are represented by contracts and terminal classifier; provider webhook tests cover rejection/void. |
| SATISFIED | webhook | Verify Documenso webhook secret before processing and reject missing/invalid signatures. | `convex/payments/webhooks/verification.ts`, `convex/deals/envelopeWebhooks.ts`, `convex/deals/__tests__/envelopes.test.ts` | Unit coverage verifies valid and invalid HMAC signatures. |
| SATISFIED | webhook | Persist raw/provider event evidence, dedupe by provider event id, and record processing status/failure. | `convex/deals/envelopeWebhooks.ts`, `convex/deals/__tests__/envelopes.test.ts` | Duplicate and unmatched provider event tests cover idempotency/failure. |
| SATISFIED | lifecycle | Normalize sent/opened/signed/completed/declined/voided/expired events into attempt/recipient state. | `convex/deals/envelopeWebhooks.ts` | Tests cover signed/completed plus decline/void exception paths. |
| SATISFIED | lifecycle | Do not trust provider completion until active required recipients are complete. | `convex/deals/envelopeWebhooks.ts` | Completion reducer is checked before returning `shouldEmitAllPartiesSigned`. |
| SATISFIED | lifecycle | Emit `ALL_PARTIES_SIGNED` through the transition engine only after verified completion; never patch `deals.status` directly. | `convex/deals/envelopeWebhooks.ts` | Uses `internal.engine.transitionMutation.transitionMutation`; `executeTransition` was not edited. |
| SATISFIED | lifecycle | Treat reissue as a new active attempt with supersede/superseded lineage and preserved history. | `convex/deals/envelopes.ts`, `convex/deals/__tests__/envelopes.test.ts` | Reissue test verifies old attempt inactive and linked to new attempt. |
| SATISFIED | exceptions | Prevent send/approval when signatory mapping is incomplete and surface a configuration exception. | `convex/deals/envelopes.ts`, `convex/deals/__tests__/envelopes.test.ts` | Missing signatory mapping creates `pre_send_configuration_failure`. |
| SATISFIED | operations | Keep reminders operational and outside governed lifecycle transitions. | `convex/deals/envelopes.ts` | Reminder records a provider event only; no transition call. |
| SATISFIED | auth | Projection queries enforce server-side deal access and only expose embedded token data to the current recipient. | `convex/deals/envelopes.ts`, `convex/deals/__tests__/envelopes.test.ts` | Token scoping is tested for buyer vs lawyer recipient. |
| SATISFIED | projection | Integrate signing state into package/deal projections without making unavailable signable placeholders downloadable. | `convex/documents/dealPackages.ts`, `convex/deals/queries.ts`, `src/test/convex/documents/dealPackages.test.ts` | Existing package surface tests still pass. |
| SATISFIED | Convex standards | Exported Convex endpoints use fluent builders with explicit `.public()`/`.internal()` where applicable. | `convex/deals/envelopes.ts` | HTTP action follows existing Convex HTTP router pattern. |
| SATISFIED | package surface | Preserve signable placeholder hiding for participant downloads. | `convex/documents/dealPackages.ts`, `src/test/convex/documents/dealPackages.test.ts` | Targeted package tests pass. |
| SATISFIED | tests | Focused backend tests cover attempt creation, config exception, completion, duplicate webhook, invalid signature, rejection/void, provider mismatch, reissue lineage, token scoping. | `convex/deals/__tests__/envelopes.test.ts` | 9 envelope tests pass. |
| SATISFIED | validation | `bunx convex codegen`, `bun check`, `bun typecheck`, and targeted tests pass. | command outputs from 2026-04-24 | `bun check` exits 0 with existing warnings. |
| SATISFIED | GitNexus | Run impact before edits and avoid modifying CRITICAL `executeTransition`. | `specs/ENG-342/summary.md`, command history | Follow-up GitNexus CLI has no exact detect command; status/analyze/diff were used as equivalent scope evidence. |
| PARTIAL | validation | `bun run test` passes before completion. | `bun run test` | Full suite fails 26 unrelated existing tests; targeted ENG-342 tests pass. |
| PARTIAL | validation | `bun run review` passes before completion. | `bun run review` | CodeRabbit refuses branch with 952 files. |
| UNVERIFIED | manual/provider | Live Documenso provider delivery and exact production header configuration. | local mocked tests only | Requires provider-environment manual checkpoint from the issue. |

## Open Questions
- Whether CodeRabbit should be run against a narrower PR branch/base so it does not count 952 files.
- Whether the existing repo-wide full-test failures should be fixed in this branch or treated as upstream blockers outside ENG-342.
