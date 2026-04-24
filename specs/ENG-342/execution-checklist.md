# Execution Checklist: ENG-342 - Deal closing: add envelope attempts, webhooks, and signing exceptions

## Requirements From Linear
- [x] Add first-class envelope attempt schema/validators for `dealId`, `packageId`, `dealDocumentInstanceId`, `generatedDocumentId`, provider, provider document/envelope id, attempt number, status, recipient roster, active/superseded lineage, terminal reason, and timestamps.
- [x] Add recipient progress schema/validators that preserve platform role, Documenso role, signing order, required/completion semantics, provider recipient id, embedded signing token availability/expiry, read/send/signing statuses, rejection reason, and timestamps.
- [x] Add signing exception schema/projection for pre-send configuration failure, send failure, signing stall, recipient rejection, cancellation/void, and reconciliation mismatch.
- [x] Add verified Documenso webhook HTTP ingestion: reject missing/invalid secret before processing, persist raw/provider event evidence, dedupe by provider event id, and record processing status/failure.
- [x] Normalize Documenso events into attempt/recipient updates without trusting provider completion until the active required recipient set is verified complete.
- [x] Emit `ALL_PARTIES_SIGNED` exactly once through internal transition execution only after active required recipients complete; never patch `deals.status` directly.
- [x] Treat recipient replacement or package/signatory changes after send as a new envelope attempt with supersede/superseded lineage; preserve prior attempt history.
- [x] Prevent lawyer approval/send when signatory mapping, package generation, provider config, or pre-send validation is incomplete; surface explicit exceptions instead of silent failures.
- [x] Keep reminders as operational actions that do not advance the governed deal lifecycle.
- [x] Add access-checked projection queries for admin, lawyer, and participant consumers; embedded signing tokens must only be returned for the authenticated current recipient.
- [x] Integrate envelope state into package/deal projections without making signable placeholders downloadable before a server-available artifact exists.
- [x] Keep all exported Convex endpoints on fluent builders with explicit visibility where applicable and avoid `any` unless isolated/justified.

## Definition Of Done From Linear
- [x] Signable package members can produce tracked Documenso envelope attempts with ordered recipients and active/superseded attempt lineage.
- [x] Documenso webhooks are secret-verified, durably persisted, idempotent by provider event id, and reflected in recipient/attempt progress.
- [x] Duplicate and out-of-order provider events do not duplicate attempts, events, transition emissions, or recipient completion state.
- [x] `ALL_PARTIES_SIGNED` is emitted exactly once through the transition engine only after verified completion of the active required recipient set.
- [x] Rejection, void/cancel, send failure, config failure, stall, and reconciliation mismatch create queryable exceptions and do not auto-cancel or auto-advance the deal.
- [x] Reissue creates a new attempt and preserves previous attempt history.
- [x] Projection queries enforce server-side deal access and only expose embedded signing token data to the authorized recipient.
- [x] Existing package surfaces continue hiding unavailable signable placeholders from participant downloads.
- [x] Focused backend tests cover attempt creation, missing signatory config, valid completion, duplicate webhook, invalid webhook secret, rejection/void, provider mismatch, and reissue lineage.
- [ ] `bunx convex codegen`, `bun check`, `bun typecheck`, targeted envelope/webhook tests, `bun run test`, and `bun run review` pass before completion.
  - Blocked: `bun run test` fails 26 existing tests outside ENG-342; `bun run review` fails before review because CodeRabbit sees 952 files.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit/backend tests added for envelope attempts, recipient gates, exceptions, reissue lineage, and webhook normalization/idempotency.
- [ ] E2E tests are not expected for this backend contract slice unless route behavior changes.
- [ ] Storybook stories are not expected because this issue does not introduce reusable UI components or screens.

## Final Validation
- [x] All requirements are satisfied.
- [ ] All definition-of-done items are satisfied.
  - Blocked by required full test and review gates.
- [x] Required quality gates passed or blockers are explicitly recorded.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
