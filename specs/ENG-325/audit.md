# Spec Audit: ENG-325 - Broker onboarding: converge Account Claim onto broker resolve-or-provision

- Audit skill: `$linear-pr-spec-audit`
- Review target: local branch diff on `codex/eng-325-broker-claim-convergence`
- Last run: 2026-04-24T13:49:58Z
- Verdict: ready

## Findings
- none

## Unresolved items
- none

## Review finding resolution
- Resolved: existing broker portal slug and hosts are preserved during claim convergence when a broker/org portal already exists.
- Resolved: populated broker profile and provenance fields are preserved during portal-ready activation.
- Resolved: verified-email ambiguity matching is normalized by casing before deciding whether a claim is safe.
- Resolved: focused coverage now includes normalized email ambiguity, duplicate auth-linked brokers, cross-org matches, portal slug preservation, and activation-field preservation.

## Validation notes
- `bun run test -- src/test/convex/brokers/claimConvergence.test.ts` passes: 13/13 tests.
- Final execution artifact validation passes.
- Earlier full `bun run test` is not clean on this branch, but the observed failures are in unrelated pre-existing suites: listing schema fixtures, lender listing ConvexProvider setup, backend auth import guard, transfer reconciliation auth, and one root-route timeout.

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | capability | Claim convergence contract exists with safe reuse, self-serve fallback, and manual-review outcomes | `convex/brokers/claimConvergence.ts` | Outcome union is explicit and narrow for future UI consumers. |
| SATISFIED | backend behavior | Reuse canonical broker resolve/provision and activation seams instead of claim-only activation | `convergeBrokerClaimToCanonicalBroker`, `resolveOrProvisionBrokerForActivation`, `ensureBrokerPortalForActivation` | Activation helper is only called after safe candidate detection and portal slug availability. |
| SATISFIED | identity matching | Match by strongest verified identifiers and fail closed on ambiguity | `collectClaimCandidates`, tests for ambiguous license and cross-user matches | Duplicate license rows and cross-user matches return manual review. |
| SATISFIED | persistence | Patch safe missing broker profile fields onto canonical record | `patchSafeClaimBrokerFields`, no-portal safe-match test | No portal slug path patches fields without marking the broker active. |
| SATISFIED | synchronization | Preserve `users.homePortalId` source of truth | `syncUserHomePortalAssignmentByUserId` call, safe portal reuse test | High-risk portal helper is reused unchanged. |
| SATISFIED | duplicate prevention | No safe match routes to self-serve instead of silent provisioning | no-match test verifies no broker insert | Claim helper throws if activation helper unexpectedly creates a broker. |
| SATISFIED | harness | Thin internal callable exists before production claim UI | `convergeBrokerClaimHarness` | Internal visibility is explicit via fluent-convex `.internal()`. |
| SATISFIED | tests | Focused tests cover safe reuse, ambiguity, fallback, duplicate prevention, portal reuse | `src/test/convex/brokers/claimConvergence.test.ts` | 13/13 tests pass. |
| OUT_OF_SCOPE | frontend | Production claim UI, e2e, and Storybook coverage | ENG-325 plan says prefer backend helper and internal/test harness when no UI exists | No UI was added. |

## Next action
- none
