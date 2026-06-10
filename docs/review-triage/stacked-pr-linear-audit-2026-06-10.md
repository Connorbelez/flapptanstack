# Stacked PR Linear Audit Report

Current branch: `mobilelistingspage`
Analyzed PRs: #509, #513, #510, #514, #532, #534, #523, #524, #512, #518, #520, #540, #541, #511, #519, #515, #517, #535, #516, #521, #533, #537, #538, #536, #539, #542, #543, #551, #552, #561, #559, #563, #565, #567, #568, #572, #573, #575, #574, #576, #577
Generated: 2026-06-10
Report file: `docs/review-triage/stacked-pr-linear-audit-2026-06-10.md`

## Executive Summary

- PRs audited: 41
- PRs missing linked Linear issue: 6
- Linked Linear issues audited: 35 primary issues, with 52 issue keys mentioned across PR metadata/comments. Four mentioned keys were invalid in Linear: ENG-526, ENG-529, ENG-530, ENG-531.
- Related Linear issues reviewed: related issue metadata was fetched from Linear GraphQL where available; local `specs/ENG-*` artifacts were used as the implementation ledger.
- Requirement gaps: 13
- Tech debt findings: 2
- Final recommendations:
  - lgtm: 20
  - Tech Debt: 0
  - Half assed: 0
  - Gaps Found: 13
  - Critical Gaps: 8
- Highest severity: Critical
- Highest-risk remaining area: top-stack governance and validation discipline. Six PRs have no discoverable Linear linkage, PR #559 is a draft mixed-scope bridge with no usable ENG-360 audit artifact, and PR #563's title/body point at ENG-366 while the branch/files point at ENG-361.
- Recommended parallelization: fix missing Linear linkage first as independent PR metadata/spec cleanups; batch ENG-342/ENG-346/ENG-347/ENG-348 validation blockers because they share dev-deployment/e2e gate issues; handle #559/#563 as separate stack hygiene decisions before further review.

Notes:
- I stayed on `mobilelistingspage`. Existing working tree changes were present before this audit and were not modified except for this report.
- GitNexus MCP tools were not exposed in this thread. `npx gitnexus status` reports the current worktree index is up to date at commit `956b506`; a CLI query initially required explicit repo selection because several `fairlendapp` indexes exist.
- The stock `linear issue` CLI is currently broken against Linear's schema (`Cannot query field "milestone" on type "Project"`), so issue bodies/comments/relations were fetched via direct Linear GraphQL.

## PR Recommendation Matrix

| PR | Branch | Linked Linear issue | Related issues | Gap severity | Tech debt screen | Final recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| #509 ENG-337 | `eng-337-velocity` -> `main` | ENG-337 | none material | None | None | lgtm |
| #513 eng-335 velocity | `eng-335-velocity` -> `eng-337-velocity` | ENG-335 | ENG-355 mentioned | None | None | lgtm |
| #510 Implemented ENG-339 end to end. | `eng-339-listing-lock` -> `eng-335-velocity` | ENG-339 | none material | None | None | lgtm |
| #514 eng-340 | `eng-340-stripe-checkout-start` -> `eng-339-listing-lock` | ENG-340 | none material | None | None | lgtm |
| #532 Implement ENG-349 checkout deal handoff | `Connorbelez/eng-349-checkout-create-deal-from-paid-checkout-and-hand-off` -> `eng-340-stripe-checkout-start` | ENG-349 | ENG-344 mentioned | None | None | lgtm |
| #534 ENG-350 listing lock | `eng-350-listinglock` -> `Connorbelez/eng-349-checkout-create-deal-from-paid-checkout-and-hand-off` | ENG-350 | none material | None | None | lgtm |
| #523 eng-344 listing lock | `eng-344-listinglock` -> `eng-350-listinglock` | ENG-344 | none material | None | None | lgtm |
| #524 Implemented ENG-345 end to end. | `eng-345-listinglock` -> `eng-344-listinglock` | ENG-345 | none material | None | None | lgtm |
| #512 ENG-303 Broker Portal Head | `eng-303-broker-portal` -> `eng-345-listinglock` | ENG-303 | ENG-333, ENG-336 mentioned | None | Watch | lgtm |
| #518 ENG-305 Broker Portal | `eng-305` -> `eng-303-broker-portal` | ENG-305 | none material | Medium | None | Gaps Found |
| #520 ENG-304 Broker Portal | `eng-304` -> `eng-305` | ENG-304 | none material | None | None | lgtm |
| #540 ENG-306 Broker Portal | `codex/eng-306-lender-handoff` -> `eng-304` | ENG-306 | none material | Medium | None | Gaps Found |
| #541 ENG-307 Broker Portal - Borrower Financing | `codex/eng-307-borrower-financing-handoff` -> `codex/eng-306-lender-handoff` | ENG-307 | none material | Medium | None | Gaps Found |
| #511 ENG-338 Deal Closing Head | `eng-338-deal-closing` -> `codex/eng-307-borrower-financing-handoff` | ENG-338 | none material | None | None | lgtm |
| #519 ENG-341 Deal Closing | `eng-341-deal-closing-vertical` -> `eng-338-deal-closing` | ENG-341 | ENG-276, ENG-286, ENG-300, ENG-301, ENG-302 mentioned | None | Watch | lgtm |
| #515 ENG-342 - Deal Closing | `eng-342-deal-closing` -> `eng-341-deal-closing-vertical` | ENG-342 | none material | High | None | Gaps Found |
| #517 ENG-347 lawyer workspace end to end | `eng-347-deal-closing` -> `eng-342-deal-closing` | ENG-347 | ENG-342, ENG-338 mentioned | High | None | Gaps Found |
| #535 add marketplace pdf viewer | `pdf-viewer` -> `eng-347-deal-closing` | not found | none | Critical | None | Critical Gaps |
| #516 ENG-343 Deal Closing | `eng-343-harden-close-side-effects` -> `pdf-viewer` | ENG-343 | none material | None | None | lgtm |
| #521 ENG-348 | `eng-348` -> `eng-343-harden-close-side-effects` | ENG-348 | none material | High | Watch | Gaps Found |
| #533 Implemented ENG-352. | `eng-352` -> `eng-348` | ENG-352 | none material | Medium | None | Gaps Found |
| #537 eng-353-mic-access-request-intake. | `codex/eng-353-mic-access-request-intake` -> `eng-352` | ENG-353 | none material | None | None | lgtm |
| #538 Implemented ENG-354 | `codex/eng-354-mic-admin-triage-provisioning` -> `codex/eng-353-mic-access-request-intake` | ENG-354 | none material | None | None | lgtm |
| #536 ENG-355 Mic Portal | `eng-355` -> `codex/eng-354-mic-admin-triage-provisioning` | ENG-355 | none material | Medium | None | Gaps Found |
| #539 ENG-356 | `eng-356` -> `eng-355` | ENG-356 | none material | None | None | lgtm |
| #542 ENG-357 | `04-26-eng-357` -> `eng-356` | ENG-357 | none material | Medium | None | Gaps Found |
| #543 ENG-358 | `eng-358` -> `04-26-eng-357` | ENG-358 | invalid ENG-526/529/530/531 mentions, ENG-44 mentioned | Medium | None | Gaps Found |
| #551 ENG-351 + various fixes | `ENG-351` -> `eng-358` | ENG-351 | none material | Medium | Watch | Gaps Found |
| #552 Implemented ENG-346 | `eng-346-deal-closing-vertical-terminal` -> `ENG-351` | ENG-346 | none material | Medium | None | Gaps Found |
| #561 Implemented ENG-359 | `eng-359-lawyeronboarding-head` -> `eng-346-deal-closing-vertical-terminal` | ENG-359 | ENG-360/361/362/363/365 mentioned | None | None | lgtm |
| #559 ENG-360 + various fixes | `eng-360` -> `eng-359-lawyeronboarding-head` | ENG-360 | ENG-351, ENG-359, ENG-361, ENG-362, ENG-363, ENG-365, ENG-340, ENG-344, ENG-345, ENG-349, ENG-350 mentioned | Critical | Critical Tech Debt | Critical Gaps |
| #563 Implemented ENG-366's File Workspace foundation | `eng-361-platformlawyer-management` -> `eng-360` | ENG-366 in title/body, ENG-361 in branch/files | ENG-367/368/369/370, ENG-359/363/365 mentioned | Critical | Tech Debt | Critical Gaps |
| #565 Implemented ENG-362 | `eng-362` -> `eng-361-platformlawyer-management` | ENG-362 | ENG-360, ENG-359, ENG-363, ENG-364 mentioned | Medium | None | Gaps Found |
| #567 Implemented ENG-363 | `eng-363` -> `eng-362` | ENG-363 | ENG-359, ENG-361, ENG-362, ENG-364, ENG-365 mentioned | None | None | lgtm |
| #568 ENG-364 | `eng-364` -> `eng-363` | ENG-364 | ENG-362, ENG-363 mentioned | None | None | lgtm |
| #572 04-30-deal-portal big refactors and cleanup | `04-30-deal-portal-prod` -> `eng-364` | ENG-365 | ENG-361, ENG-363 mentioned | None | None | lgtm |
| #573 payment-schedule-replacement | `codex/payment-schedule-replacement` -> `04-30-deal-portal-prod` | not found | none | Critical | Critical Tech Debt | Critical Gaps |
| #575 lawyer-onboarding lso orchestrtor | `codex/lawyer-onboarding-lso-orchestrator` -> `codex/payment-schedule-replacement` | not found | none | Critical | None | Critical Gaps |
| #574 admin-lawyers-management. | `codex/admin-lawyers-management` -> `codex/lawyer-onboarding-lso-orchestrator` | not found | none | Critical | Critical Tech Debt | Critical Gaps |
| #576 admin-fee-management | `codex/admin-fee-management` -> `codex/admin-lawyers-management` | not found | none | Critical | None | Critical Gaps |
| #577 Admin lender broker reassignment flow. | `05-03-admin-lender-broker-reassignment` -> `codex/admin-fee-management` | not found | none | Critical | Watch | Critical Gaps |

## Gap Analysis

### lgtm PRs

The following PRs have linked primary Linear issues, local spec/audit artifacts or targeted validation evidence, and no production-grade gaps found in this audit: #509, #513, #510, #514, #532, #534, #523, #524, #512, #520, #511, #519, #516, #537, #538, #539, #561, #567, #568, #572.

Validation caveat: several local spec artifacts record unrelated full-suite failures or unavailable GitNexus `detect-changes` commands from their original worktrees. Those were not treated as PR-specific gaps when the issue audit itself was `ready` and the current-code evidence did not contradict it.

### PR 518: ENG-305 Broker Portal

- Branch: `eng-305` -> `eng-303-broker-portal`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/518
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/518
- Linked Linear issue: ENG-305
- Final recommendation: Gaps Found
- Gap severity: Medium
- Summary: local audit verdict is `needs manual validation`; the production landing contract could not be validated against active local portal data.
- Missing requirements: manual live-data validation of the portal landing contract.
- Requirement ledger: SATISFIED 0, PARTIAL 1, MISSING 0, CONTRADICTED 0, UNVERIFIED 1, OUT_OF_SCOPE 0
- Validation evidence: `specs/ENG-305/audit.md`, `specs/ENG-305/status.md`

### PR 540: ENG-306 Broker Portal

- Branch: `codex/eng-306-lender-handoff` -> `eng-304`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/540
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/540
- Linked Linear issue: ENG-306
- Final recommendation: Gaps Found
- Gap severity: Medium
- Summary: WorkOS hosted-auth browser round trip remains manual-only.
- Missing requirements: full external hosted-auth validation.
- Requirement ledger: SATISFIED 0, PARTIAL 1, MISSING 0, CONTRADICTED 0, UNVERIFIED 1, OUT_OF_SCOPE 0
- Validation evidence: `specs/ENG-306/audit.md`

### PR 541: ENG-307 Borrower Financing

- Branch: `codex/eng-307-borrower-financing-handoff` -> `codex/eng-306-lender-handoff`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/541
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/541
- Linked Linear issue: ENG-307
- Final recommendation: Gaps Found
- Gap severity: Medium
- Summary: local audit requires additional validation because full repo tests were blocked outside the route handoff scope.
- Missing requirements: full validation closure or explicit isolation of unrelated failures.
- Requirement ledger: SATISFIED 0, PARTIAL 1, MISSING 0, CONTRADICTED 0, UNVERIFIED 1, OUT_OF_SCOPE 0
- Validation evidence: `specs/ENG-307/audit.md`

### PR 515: ENG-342 Deal Closing

- Branch: `eng-342-deal-closing` -> `eng-341-deal-closing-vertical`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/515
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/515
- Linked Linear issue: ENG-342
- Final recommendation: Gaps Found
- Gap severity: High
- Summary: the spec audit verdict is `not ready`; full repo test and review gates remain blocked.
- Missing requirements: required review gate and full validation closure.
- Requirement ledger: SATISFIED 0, PARTIAL 2, MISSING 0, CONTRADICTED 0, UNVERIFIED 1, OUT_OF_SCOPE 0
- Validation evidence: `specs/ENG-342/audit.md:6`, `specs/ENG-342/audit.md:10`, `specs/ENG-342/status.md:3`

### PR 517: ENG-347 Lawyer Workspace

- Branch: `eng-347-deal-closing` -> `eng-342-deal-closing`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/517
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/517
- Linked Linear issue: ENG-347
- Final recommendation: Gaps Found
- Gap severity: High
- Summary: implementation findings were resolved, but targeted browser validation remains blocked by existing dev data/schema drift and full e2e failures.
- Missing requirements: targeted ENG-347 e2e validation and full e2e confidence.
- Requirement ledger: SATISFIED 0, PARTIAL 1, MISSING 0, CONTRADICTED 0, UNVERIFIED 1, OUT_OF_SCOPE 0
- Validation evidence: `specs/ENG-347/audit.md:6`, `specs/ENG-347/audit.md:9`, `specs/ENG-347/status.md:12`

### PR 535: Marketplace PDF Viewer

- Branch: `pdf-viewer` -> `eng-347-deal-closing`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/535
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/535
- Linked Linear issue: not found
- Final recommendation: Critical Gaps
- Gap severity: Critical
- Summary: no Linear issue key was found in branch, title, body, commit metadata, or fetched PR discussion.
- Missing requirements: requirement source of truth and acceptance criteria.
- Requirement ledger: SATISFIED 0, PARTIAL 0, MISSING 1, CONTRADICTED 0, UNVERIFIED 0, OUT_OF_SCOPE 0
- Validation evidence: PR metadata and changed files only.

### PR 521: ENG-348 Participant Workspace

- Branch: `eng-348` -> `eng-343-harden-close-side-effects`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/521
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/521
- Linked Linear issue: ENG-348
- Final recommendation: Gaps Found
- Gap severity: High
- Summary: current code appears to have remediated the stale receipt-evidence finding, but e2e acceptance coverage and final validation remain incomplete.
- Missing requirements: participant happy path, unauthorized denial, completed receipt e2e execution, and final validation closure.
- Requirement ledger: SATISFIED 1, PARTIAL 2, MISSING 0, CONTRADICTED 0, UNVERIFIED 1, OUT_OF_SCOPE 0
- Validation evidence: `specs/ENG-348/audit.md:9`, `specs/ENG-348/audit.md:10`, `specs/ENG-348/tasks.md:32`, `src/components/deals/participant/ParticipantDealWorkspacePage.tsx:257`, `convex/deals/__tests__/participantWorkspace.test.ts:473`

### PR 533: ENG-352

- Branch: `eng-352` -> `eng-348`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/533
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/533
- Linked Linear issue: ENG-352
- Final recommendation: Gaps Found
- Gap severity: Medium
- Summary: local audit says code readiness is not blocked, but WorkOS and seeded-environment checks remain manual.
- Missing requirements: operational rollout validation.
- Requirement ledger: SATISFIED 0, PARTIAL 1, MISSING 0, CONTRADICTED 0, UNVERIFIED 1, OUT_OF_SCOPE 0
- Validation evidence: `specs/ENG-352/audit.md`

### PR 536: ENG-355 MIC Portal

- Branch: `eng-355` -> `codex/eng-354-mic-admin-triage-provisioning`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/536
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/536
- Linked Linear issue: ENG-355
- Final recommendation: Gaps Found
- Gap severity: Medium
- Summary: local audit verdict is `needs manual validation`.
- Missing requirements: manual validation closure.
- Requirement ledger: SATISFIED 0, PARTIAL 1, MISSING 0, CONTRADICTED 0, UNVERIFIED 1, OUT_OF_SCOPE 0
- Validation evidence: `specs/ENG-355/audit.md`

### PR 542: ENG-357

- Branch: `04-26-eng-357` -> `eng-356`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/542
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/542
- Linked Linear issue: ENG-357
- Final recommendation: Gaps Found
- Gap severity: Medium
- Summary: linked issue and task artifact exist, but no local audit/status artifact was found for this PR in the current branch.
- Missing requirements: requirement-ledger audit evidence.
- Requirement ledger: SATISFIED 0, PARTIAL 0, MISSING 0, CONTRADICTED 0, UNVERIFIED 1, OUT_OF_SCOPE 0
- Validation evidence: `specs/ENG-357/tasks.md`

### PR 543: ENG-358

- Branch: `eng-358` -> `04-26-eng-357`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/543
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/543
- Linked Linear issue: ENG-358
- Final recommendation: Gaps Found
- Gap severity: Medium
- Summary: linked issue and task artifact exist, but no local audit/status artifact was found. PR discussion also mentions invalid Linear keys ENG-526, ENG-529, ENG-530, and ENG-531.
- Missing requirements: requirement-ledger audit evidence and cleanup of invalid issue references.
- Requirement ledger: SATISFIED 0, PARTIAL 0, MISSING 0, CONTRADICTED 0, UNVERIFIED 1, OUT_OF_SCOPE 0
- Validation evidence: `specs/ENG-358/tasks.md`

### PR 551: ENG-351

- Branch: `ENG-351` -> `eng-358`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/551
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/551
- Linked Linear issue: ENG-351
- Final recommendation: Gaps Found
- Gap severity: Medium
- Summary: PR title and commit message explicitly mix ENG-351 with broad UI, obligations, payment ops, deal portal, and listing-detail fixes; only `tasks.md` exists locally.
- Missing requirements: focused audit evidence for the mixed-scope PR.
- Requirement ledger: SATISFIED 0, PARTIAL 0, MISSING 0, CONTRADICTED 0, UNVERIFIED 1, OUT_OF_SCOPE 0
- Validation evidence: `specs/ENG-351/tasks.md`

### PR 552: ENG-346

- Branch: `eng-346-deal-closing-vertical-terminal` -> `ENG-351`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/552
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/552
- Linked Linear issue: ENG-346
- Final recommendation: Gaps Found
- Gap severity: Medium
- Summary: local audit verdict is `needs manual validation`; e2e is blocked by missing `TEST_ACCOUNT_EMAIL`, and CodeRabbit review is blocked by file-count limits.
- Missing requirements: admin denial-path and full e2e validation.
- Requirement ledger: SATISFIED 0, PARTIAL 2, MISSING 0, CONTRADICTED 0, UNVERIFIED 1, OUT_OF_SCOPE 0
- Validation evidence: `specs/ENG-346/audit.md:6`, `specs/ENG-346/audit.md:10`, `specs/ENG-346/status.md:12`

### PR 559: ENG-360 Draft Mixed-Scope Bridge

- Branch: `eng-360` -> `eng-359-lawyeronboarding-head`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/559
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/559
- Linked Linear issue: ENG-360
- Final recommendation: Critical Gaps
- Gap severity: Critical
- Summary: PR is draft, body mixes many prior issue scopes, and no `specs/ENG-360` artifact exists in the current branch.
- Missing requirements: a focused ENG-360 requirement ledger and completion evidence.
- Requirement ledger: SATISFIED 0, PARTIAL 0, MISSING 1, CONTRADICTED 0, UNVERIFIED 1, OUT_OF_SCOPE 0
- Validation evidence: GitHub PR metadata; no local `specs/ENG-360`.

### PR 563: ENG-366/ENG-361 Mismatch

- Branch: `eng-361-platformlawyer-management` -> `eng-360`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/563
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/563
- Linked Linear issue: ambiguous: GitHub title/body says ENG-366; branch/files contain `specs/ENG-361`
- Final recommendation: Critical Gaps
- Gap severity: Critical
- Summary: the PR cannot be cleanly audited against one requirement source. There is no local `specs/ENG-366`, while the changed files include `specs/ENG-361/*`.
- Missing requirements: correct PR title/Linear link/spec artifact alignment.
- Requirement ledger: SATISFIED 0, PARTIAL 0, MISSING 1, CONTRADICTED 1, UNVERIFIED 1, OUT_OF_SCOPE 0
- Validation evidence: PR metadata and changed-file list.

### PR 565: ENG-362

- Branch: `eng-362` -> `eng-361-platformlawyer-management`
- GitHub: https://github.com/Connorbelez/flapptanstack/pull/565
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/565
- Linked Linear issue: ENG-362
- Final recommendation: Gaps Found
- Gap severity: Medium
- Summary: local audit verdict is `needs manual validation` because hosted WorkOS sign-in/sign-up cannot complete in this checkout.
- Missing requirements: live WorkOS AuthKit browser callback validation.
- Requirement ledger: SATISFIED 0, PARTIAL 1, MISSING 0, CONTRADICTED 0, UNVERIFIED 1, OUT_OF_SCOPE 0
- Validation evidence: `specs/ENG-362/audit.md`

### PRs 573, 575, 574, 576, 577: Missing Linear Linkage

- Branches:
  - #573 `codex/payment-schedule-replacement` -> `04-30-deal-portal-prod`
  - #575 `codex/lawyer-onboarding-lso-orchestrator` -> `codex/payment-schedule-replacement`
  - #574 `codex/admin-lawyers-management` -> `codex/lawyer-onboarding-lso-orchestrator`
  - #576 `codex/admin-fee-management` -> `codex/admin-lawyers-management`
  - #577 `05-03-admin-lender-broker-reassignment` -> `codex/admin-fee-management`
- Linked Linear issue: not found
- Final recommendation: Critical Gaps for all five
- Gap severity: Critical
- Summary: no Linear issue key was found in branch, title, body, commit metadata, or fetched PR discussion. These are requirement-heavy admin/payment/legal/accounting changes and should not be reviewed without traceable acceptance criteria.
- Missing requirements: requirement source of truth, acceptance criteria, related issue context, and auditable DoD.
- Requirement ledger: SATISFIED 0, PARTIAL 0, MISSING 5, CONTRADICTED 0, UNVERIFIED 0, OUT_OF_SCOPE 0
- Validation evidence: PR metadata and changed files. #574 commit metadata explicitly says the implementation is temporary and "spaghetti"; #577 current UI still has a temporary codegen workaround at `src/components/admin/lenders/BrokerReassignmentDialog.tsx:42`.

## Tech Debt Screen

### Critical Tech Debt

- #573 `codex/payment-schedule-replacement`: broad PR without Linear linkage, many unrelated generated/brainstorm/review artifacts in the file list, and release notes spanning payment schedule replacement, admin lawyer roster, investor portfolio, fee admin, deal portal, WorkOS invitations, and marketplace checkout. This should be decomposed or linked to a governing Linear parent with explicit child acceptance criteria.
- #574 `codex/admin-lawyers-management`: commit metadata states "temporary implementation of admin/lawyers table" and "lawyers needs to be added as a system object and a lot of the code is spaghetti." Current code does define legal-representation tables and admin surfaces, but the PR has no linked Linear issue proving the temporary path was later closed.

### Watch

- #577 `05-03-admin-lender-broker-reassignment`: current UI uses a temporary manual Convex function reference workaround at `src/components/admin/lenders/BrokerReassignmentDialog.tsx:42`. This may be harmless if codegen has since run elsewhere, but it should not survive as an unowned compatibility layer.
- #519 `eng-341-deal-closing-vertical`: commit history includes "temp fix on listing route race condition, just using existing admin route guard, this MUST be changed before prod" from lower-stack marketplace/portal work. Current route/auth behavior may have been remediated, but the stack needs a focused route-auth sweep before production.
- #512 `eng-303-broker-portal` and #551 `ENG-351`: both show broad/mixed-scope PR titles or related issue references. No immediate correctness gap was proven for #512, but future review should keep issue scope tight.

## Manifest

### PR 518: ENG-305 Broker Portal

Linear issue: ENG-305
Final recommendation: Gaps Found

<!-- manifest:PR518-F1 -->
- [ ] PR518-F1: Complete ENG-305 manual live-data validation
  - Status: open
  - Source: Linear requirement
  - Severity: Medium
  - Final recommendation impact: Gaps Found
  - Current files/lines: `specs/ENG-305/audit.md`
  - PR branch: `eng-305` -> `eng-303-broker-portal`
  - Relevant issues: ENG-305
  - Recommended fix: validate the production landing contract against seeded/active portal data and update the audit artifact.
  - Parallelization: independent
<!-- /manifest:PR518-F1 -->

### PR 540: ENG-306 Broker Portal

Linear issue: ENG-306
Final recommendation: Gaps Found

<!-- manifest:PR540-F1 -->
- [ ] PR540-F1: Run hosted WorkOS auth validation for lender handoff
  - Status: open
  - Source: Linear requirement
  - Severity: Medium
  - Final recommendation impact: Gaps Found
  - Current files/lines: `specs/ENG-306/audit.md`
  - PR branch: `codex/eng-306-lender-handoff` -> `eng-304`
  - Relevant issues: ENG-306
  - Recommended fix: run the hosted WorkOS browser round trip or document a production-equivalent validation path.
  - Parallelization: independent
<!-- /manifest:PR540-F1 -->

### PR 541: ENG-307 Borrower Financing

Linear issue: ENG-307
Final recommendation: Gaps Found

<!-- manifest:PR541-F1 -->
- [ ] PR541-F1: Close ENG-307 validation caveat
  - Status: open
  - Source: Linear requirement
  - Severity: Medium
  - Final recommendation impact: Gaps Found
  - Current files/lines: `specs/ENG-307/audit.md`
  - PR branch: `codex/eng-307-borrower-financing-handoff` -> `codex/eng-306-lender-handoff`
  - Relevant issues: ENG-307
  - Recommended fix: rerun targeted and repo validation after isolating unrelated full-suite failures.
  - Parallelization: independent
<!-- /manifest:PR541-F1 -->

### PR 515: ENG-342 Deal Closing

Linear issue: ENG-342
Final recommendation: Gaps Found

<!-- manifest:PR515-F1 -->
- [ ] PR515-F1: Resolve ENG-342 blocked validation and review gates
  - Status: open
  - Source: Linear requirement
  - Severity: High
  - Final recommendation impact: Gaps Found
  - Current files/lines: `specs/ENG-342/audit.md:6`, `specs/ENG-342/audit.md:10`, `specs/ENG-342/status.md:3`
  - PR branch: `eng-342-deal-closing` -> `eng-341-deal-closing-vertical`
  - Relevant issues: ENG-342
  - Recommended fix: rerun validation on a reviewable branch target or split the branch so `bun run review` and full gates can complete.
  - Parallelization: batch with PR552-F1 and PR521-F1
<!-- /manifest:PR515-F1 -->

### PR 517: ENG-347 Lawyer Workspace

Linear issue: ENG-347
Final recommendation: Gaps Found

<!-- manifest:PR517-F1 -->
- [ ] PR517-F1: Unblock ENG-347 targeted e2e validation
  - Status: open
  - Source: Linear requirement
  - Severity: High
  - Final recommendation impact: Gaps Found
  - Current files/lines: `specs/ENG-347/audit.md:6`, `specs/ENG-347/audit.md:9`, `specs/ENG-347/status.md:12`
  - PR branch: `eng-347-deal-closing` -> `eng-342-deal-closing`
  - Relevant issues: ENG-347
  - Recommended fix: migrate or admit existing `portals.portalType = "mic"` dev data, deploy Convex once, then rerun the targeted lawyer workspace e2e.
  - Parallelization: batch with PR521-F1
<!-- /manifest:PR517-F1 -->

### PR 535: Marketplace PDF Viewer

Linear issue: not found
Final recommendation: Critical Gaps

<!-- manifest:PR535-F1 -->
- [ ] PR535-F1: Link marketplace PDF viewer PR to a Linear issue
  - Status: open
  - Source: Missing Linear linkage
  - Severity: Critical
  - Final recommendation impact: Critical Gaps
  - Current files/lines: None
  - PR branch: `pdf-viewer` -> `eng-347-deal-closing`
  - Relevant issues: None
  - Recommended fix: attach the governing Linear issue or create one that captures public document access, PDF viewer behavior, RBAC, e2e expectations, and acceptance criteria.
  - Parallelization: independent
<!-- /manifest:PR535-F1 -->

### PR 521: ENG-348 Participant Workspace

Linear issue: ENG-348
Final recommendation: Gaps Found

<!-- manifest:PR521-F1 -->
- [ ] PR521-F1: Complete participant workspace e2e and final validation
  - Status: open
  - Source: Linear requirement
  - Severity: High
  - Final recommendation impact: Gaps Found
  - Current files/lines: `specs/ENG-348/audit.md:9`, `specs/ENG-348/audit.md:10`, `specs/ENG-348/tasks.md:32`
  - PR branch: `eng-348` -> `eng-343-harden-close-side-effects`
  - Relevant issues: ENG-348
  - Recommended fix: run participant buyer/seller happy path, unauthorized denial, and completed receipt e2e after fixing the dev Convex schema/data blocker.
  - Parallelization: batch with PR517-F1
<!-- /manifest:PR521-F1 -->

### PR 533: ENG-352

Linear issue: ENG-352
Final recommendation: Gaps Found

<!-- manifest:PR533-F1 -->
- [ ] PR533-F1: Close WorkOS and seeded-environment manual checks
  - Status: open
  - Source: Linear requirement
  - Severity: Medium
  - Final recommendation impact: Gaps Found
  - Current files/lines: `specs/ENG-352/audit.md`
  - PR branch: `eng-352` -> `eng-348`
  - Relevant issues: ENG-352
  - Recommended fix: run the recorded WorkOS and seeded-environment checks and update the audit artifact.
  - Parallelization: independent
<!-- /manifest:PR533-F1 -->

### PR 536: ENG-355 MIC Portal

Linear issue: ENG-355
Final recommendation: Gaps Found

<!-- manifest:PR536-F1 -->
- [ ] PR536-F1: Complete ENG-355 manual validation
  - Status: open
  - Source: Linear requirement
  - Severity: Medium
  - Final recommendation impact: Gaps Found
  - Current files/lines: `specs/ENG-355/audit.md`
  - PR branch: `eng-355` -> `codex/eng-354-mic-admin-triage-provisioning`
  - Relevant issues: ENG-355
  - Recommended fix: run and record the remaining manual MIC portal validation.
  - Parallelization: independent
<!-- /manifest:PR536-F1 -->

### PR 542: ENG-357

Linear issue: ENG-357
Final recommendation: Gaps Found

<!-- manifest:PR542-F1 -->
- [ ] PR542-F1: Add missing ENG-357 audit artifact
  - Status: open
  - Source: Linear requirement
  - Severity: Medium
  - Final recommendation impact: Gaps Found
  - Current files/lines: `specs/ENG-357/tasks.md`
  - PR branch: `04-26-eng-357` -> `eng-356`
  - Relevant issues: ENG-357
  - Recommended fix: run a requirement-ledger audit for ENG-357 and persist verdict/status evidence.
  - Parallelization: independent
<!-- /manifest:PR542-F1 -->

### PR 543: ENG-358

Linear issue: ENG-358
Final recommendation: Gaps Found

<!-- manifest:PR543-F1 -->
- [ ] PR543-F1: Add missing ENG-358 audit artifact and clean invalid issue references
  - Status: open
  - Source: Linear requirement
  - Severity: Medium
  - Final recommendation impact: Gaps Found
  - Current files/lines: `specs/ENG-358/tasks.md`
  - PR branch: `eng-358` -> `04-26-eng-357`
  - Relevant issues: ENG-358, invalid ENG-526, invalid ENG-529, invalid ENG-530, invalid ENG-531
  - Recommended fix: run a requirement-ledger audit for ENG-358 and remove or correct invalid Linear references in PR discussion/spec artifacts.
  - Parallelization: independent
<!-- /manifest:PR543-F1 -->

### PR 551: ENG-351

Linear issue: ENG-351
Final recommendation: Gaps Found

<!-- manifest:PR551-F1 -->
- [ ] PR551-F1: Audit mixed-scope ENG-351 PR against explicit requirements
  - Status: open
  - Source: Linear requirement
  - Severity: Medium
  - Final recommendation impact: Gaps Found
  - Current files/lines: `specs/ENG-351/tasks.md`
  - PR branch: `ENG-351` -> `eng-358`
  - Relevant issues: ENG-351
  - Recommended fix: produce an audit artifact that separates ENG-351 requirements from unrelated UI/payment/deal/listing fixes.
  - Parallelization: independent
<!-- /manifest:PR551-F1 -->

### PR 552: ENG-346

Linear issue: ENG-346
Final recommendation: Gaps Found

<!-- manifest:PR552-F1 -->
- [ ] PR552-F1: Complete ENG-346 e2e and denial-path validation
  - Status: open
  - Source: Linear requirement
  - Severity: Medium
  - Final recommendation impact: Gaps Found
  - Current files/lines: `specs/ENG-346/audit.md:6`, `specs/ENG-346/audit.md:10`, `specs/ENG-346/status.md:12`
  - PR branch: `eng-346-deal-closing-vertical-terminal` -> `ENG-351`
  - Relevant issues: ENG-346
  - Recommended fix: provide `TEST_ACCOUNT_EMAIL`, run the deal-closing e2e project, verify admin denial paths, and rerun review against a file-count-safe target.
  - Parallelization: batch with PR515-F1
<!-- /manifest:PR552-F1 -->

### PR 559: ENG-360 Draft

Linear issue: ENG-360
Final recommendation: Critical Gaps

<!-- manifest:PR559-F1 -->
- [ ] PR559-F1: Replace draft mixed-scope bridge with a focused ENG-360 audit target
  - Status: open
  - Source: Linear requirement
  - Severity: Critical
  - Final recommendation impact: Critical Gaps
  - Current files/lines: None
  - PR branch: `eng-360` -> `eng-359-lawyeronboarding-head`
  - Relevant issues: ENG-360 plus many unrelated issue mentions
  - Recommended fix: create or restore `specs/ENG-360`, isolate the issue scope, and move unrelated fixes to their owning PRs or linked child issues.
  - Parallelization: blocked
<!-- /manifest:PR559-F1 -->

### PR 563: ENG-366/ENG-361 Mismatch

Linear issue: ambiguous
Final recommendation: Critical Gaps

<!-- manifest:PR563-F1 -->
- [ ] PR563-F1: Resolve ENG-366 title/body versus ENG-361 branch/files mismatch
  - Status: open
  - Source: Linear requirement
  - Severity: Critical
  - Final recommendation impact: Critical Gaps
  - Current files/lines: `specs/ENG-361/audit.md`
  - PR branch: `eng-361-platformlawyer-management` -> `eng-360`
  - Relevant issues: ENG-366, ENG-361
  - Recommended fix: retitle/relink the PR to the issue it actually implements, or move the ENG-366 file-workspace work into a PR with matching spec artifacts.
  - Parallelization: blocked
<!-- /manifest:PR563-F1 -->

### PR 565: ENG-362

Linear issue: ENG-362
Final recommendation: Gaps Found

<!-- manifest:PR565-F1 -->
- [ ] PR565-F1: Complete WorkOS AuthKit callback validation
  - Status: open
  - Source: Linear requirement
  - Severity: Medium
  - Final recommendation impact: Gaps Found
  - Current files/lines: `specs/ENG-362/audit.md`
  - PR branch: `eng-362` -> `eng-361-platformlawyer-management`
  - Relevant issues: ENG-362
  - Recommended fix: run hosted WorkOS sign-in/sign-up callback validation or document production-equivalent evidence.
  - Parallelization: independent
<!-- /manifest:PR565-F1 -->

### PR 573: payment-schedule-replacement

Linear issue: not found
Final recommendation: Critical Gaps

<!-- manifest:PR573-F1 -->
- [ ] PR573-F1: Add requirement traceability or split broad payment-schedule replacement PR
  - Status: open
  - Source: Missing Linear linkage
  - Severity: Critical
  - Final recommendation impact: Critical Gaps
  - Current files/lines: None
  - PR branch: `codex/payment-schedule-replacement` -> `04-30-deal-portal-prod`
  - Relevant issues: None
  - Recommended fix: link a governing Linear parent and child issues for each unrelated domain, or split the PR into reviewable requirement-owned slices.
  - Parallelization: shared refactor
<!-- /manifest:PR573-F1 -->

### PR 575: lawyer-onboarding lso orchestrtor

Linear issue: not found
Final recommendation: Critical Gaps

<!-- manifest:PR575-F1 -->
- [ ] PR575-F1: Link lawyer onboarding orchestrator PR to Linear acceptance criteria
  - Status: open
  - Source: Missing Linear linkage
  - Severity: Critical
  - Final recommendation impact: Critical Gaps
  - Current files/lines: None
  - PR branch: `codex/lawyer-onboarding-lso-orchestrator` -> `codex/payment-schedule-replacement`
  - Relevant issues: None
  - Recommended fix: attach the Linear issue covering LSO orchestration, route resume behavior, WorkOS invitation semantics, and validation requirements.
  - Parallelization: independent
<!-- /manifest:PR575-F1 -->

### PR 574: admin-lawyers-management

Linear issue: not found
Final recommendation: Critical Gaps

<!-- manifest:PR574-F1 -->
- [ ] PR574-F1: Replace temporary admin lawyers surface with requirement-owned system-object path
  - Status: open
  - Source: Missing Linear linkage
  - Severity: Critical
  - Final recommendation impact: Critical Gaps
  - Current files/lines: `convex/legalRepresentation/adminLawyers.ts`, `src/components/admin/lawyers/AdminLawyersPage.tsx`
  - PR branch: `codex/admin-lawyers-management` -> `codex/lawyer-onboarding-lso-orchestrator`
  - Relevant issues: None
  - Recommended fix: link/create a Linear issue and prove the temporary "lawyers table" path was migrated to the canonical system-object model or explicitly accepted.
  - Parallelization: shared refactor
<!-- /manifest:PR574-F1 -->

### PR 576: admin-fee-management

Linear issue: not found
Final recommendation: Critical Gaps

<!-- manifest:PR576-F1 -->
- [ ] PR576-F1: Link admin fee management/accounting changes to Linear
  - Status: open
  - Source: Missing Linear linkage
  - Severity: Critical
  - Final recommendation impact: Critical Gaps
  - Current files/lines: `convex/fees/assessments.ts`, `convex/dispersal/createDispersalEntries.ts`, `convex/payments/cashLedger/integrations.ts`
  - PR branch: `codex/admin-fee-management` -> `codex/admin-lawyers-management`
  - Relevant issues: None
  - Recommended fix: attach the governing Linear issue for fee priority, settlement linking, ledger metadata, bulk apply, and regression coverage.
  - Parallelization: independent
<!-- /manifest:PR576-F1 -->

### PR 577: Admin lender broker reassignment

Linear issue: not found
Final recommendation: Critical Gaps

<!-- manifest:PR577-F1 -->
- [ ] PR577-F1: Link broker reassignment flow to Linear and remove temporary codegen workaround
  - Status: open
  - Source: Missing Linear linkage
  - Severity: Critical
  - Final recommendation impact: Critical Gaps
  - Current files/lines: `src/components/admin/lenders/BrokerReassignmentDialog.tsx:42`, `convex/admin/lenders/reassignment.ts`
  - PR branch: `05-03-admin-lender-broker-reassignment` -> `codex/admin-fee-management`
  - Relevant issues: None
  - Recommended fix: attach/create the Linear issue for all-or-nothing WorkOS transfer semantics and replace manual function references after codegen.
  - Parallelization: independent
<!-- /manifest:PR577-F1 -->

## Findings

<!-- finding:PR515-F1 -->
### PR515-F1. Resolve ENG-342 blocked validation and review gates

Source type: Linear requirement

PR context:
- PR: #515 ENG-342 - Deal Closing, https://github.com/Connorbelez/flapptanstack/pull/515
- Branch: `eng-342-deal-closing` -> `eng-341-deal-closing-vertical`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/515

Linear context:
- Linked issue: ENG-342
- Requirement: final validation and review gates must pass before completion.
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `specs/ENG-342/audit.md:6`, `specs/ENG-342/audit.md:10`, `specs/ENG-342/status.md:3`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: audit verdict is `not ready`; status says overall blocked.

Severity: High
Final recommendation impact: Gaps Found
Reason: a deal-signing backend spine should not be marked production-ready while required review/validation gates are blocked.
Recommended fix: rerun validation on a reviewable target or split the stack so review tooling can analyze the PR.
Implementation guidance: first isolate branch-size review failure, then rerun ENG-342 targeted tests, `bun check`, `bun typecheck`, and the review gate.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: batch with other deal-closing validation blockers.
Footguns and guardrails:
- Do not waive signing/webhook validation because failures are inconvenient; record unrelated failures separately.
Validation: `bun run test`, `bun run review`, targeted ENG-342 tests.
<!-- /finding:PR515-F1 -->

<!-- finding:PR517-F1 -->
### PR517-F1. Unblock ENG-347 targeted e2e validation

Source type: Linear requirement

PR context:
- PR: #517 ENG-347 lawyer workspace end to end, https://github.com/Connorbelez/flapptanstack/pull/517
- Branch: `eng-347-deal-closing` -> `eng-342-deal-closing`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/517

Linear context:
- Linked issue: ENG-347
- Requirement: lawyer workspace e2e must prove the route/workspace flow.
- Requirement status: UNVERIFIED

Current-code evidence:
- Current location: `specs/ENG-347/audit.md:9`, `specs/ENG-347/status.md:12`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: targeted e2e exists but cannot deploy its Convex seeder due existing `portalType: "mic"` dev data outside current schema.

Severity: High
Final recommendation impact: Gaps Found
Reason: the implementation may be correct, but production confidence is incomplete without the browser route validation required by the issue.
Recommended fix: fix/migrate the dev data/schema mismatch, then rerun the targeted lawyer workspace e2e.
Implementation guidance: clear the Convex deployment blocker before changing lawyer workspace code.
Suggested owner: shared refactor owner
Shared abstraction/refactor opportunity: same dev data/schema blocker appears in ENG-348.
Footguns and guardrails:
- Do not loosen schema just to make stale dev data pass without understanding MIC portal requirements.
Validation: `bunx convex dev --once`, `bun run test:e2e -- --project=deal-closing --no-deps e2e/deal-closing/lawyer-workspace.spec.ts`.
<!-- /finding:PR517-F1 -->

<!-- finding:PR521-F1 -->
### PR521-F1. Complete participant workspace e2e and final validation

Source type: Linear requirement

PR context:
- PR: #521 ENG-348, https://github.com/Connorbelez/flapptanstack/pull/521
- Branch: `eng-348` -> `eng-343-harden-close-side-effects`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/521

Linear context:
- Linked issue: ENG-348
- Requirement: buyer/seller participant workspace e2e must cover happy path, unauthorized denial, and completed receipt.
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `specs/ENG-348/audit.md:9`, `specs/ENG-348/tasks.md:32`, `convex/deals/__tests__/participantWorkspace.test.ts:473`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: receipt-evidence regression is now covered in current tests, but e2e coverage remains open/blocked.

Severity: High
Final recommendation impact: Gaps Found
Reason: the most user-visible participant flow is not e2e-proven.
Recommended fix: run deterministic seeded e2e for buyer, seller, unauthorized, and completed receipt once dev Convex can deploy.
Implementation guidance: keep the current receipt-evidence fix; focus on test environment and e2e coverage.
Suggested owner: shared refactor owner
Shared abstraction/refactor opportunity: shared dev data/schema blocker with ENG-347.
Footguns and guardrails:
- Do not rely on admin-auth e2e for participant RBAC.
Validation: focused participant workspace e2e, `bun run test`, `bun check`, `bun typecheck`.
<!-- /finding:PR521-F1 -->

<!-- finding:PR559-F1 -->
### PR559-F1. Replace draft mixed-scope bridge with a focused ENG-360 audit target

Source type: Linear requirement

PR context:
- PR: #559 ENG-360 + various fixes, https://github.com/Connorbelez/flapptanstack/pull/559
- Branch: `eng-360` -> `eng-359-lawyeronboarding-head`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/559

Linear context:
- Linked issue: ENG-360
- Related issues: ENG-351, ENG-359, ENG-361, ENG-362, ENG-363, ENG-365, ENG-340, ENG-344, ENG-345, ENG-349, ENG-350 mentioned.
- Requirement: unclear; no local `specs/ENG-360` exists.
- Requirement status: UNVERIFIED

Current-code evidence:
- Current location: None
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: PR is draft and body mixes multiple unrelated issue scopes.

Severity: Critical
Final recommendation impact: Critical Gaps
Reason: this cannot be audited as a production PR without a focused requirement ledger.
Recommended fix: restore/create `specs/ENG-360`, split unrelated fixes, and make the PR title/body match one owner issue.
Implementation guidance: decide whether #559 is a real ENG-360 PR or a stack bridge before assigning implementation work.
Suggested owner: blocked
Shared abstraction/refactor opportunity: stack hygiene.
Footguns and guardrails:
- Do not use this PR as a dumping ground for cross-stack fixes.
Validation: rerun `$linear-pr-spec-audit` for the resolved issue.
<!-- /finding:PR559-F1 -->

<!-- finding:PR563-F1 -->
### PR563-F1. Resolve ENG-366 title/body versus ENG-361 branch/files mismatch

Source type: Linear requirement

PR context:
- PR: #563 Implemented ENG-366's File Workspace foundation, https://github.com/Connorbelez/flapptanstack/pull/563
- Branch: `eng-361-platformlawyer-management` -> `eng-360`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/563

Linear context:
- Linked issue: ambiguous: ENG-366 in title/body, ENG-361 in branch/files.
- Requirement: issue identity must be unambiguous before auditing code.
- Requirement status: CONTRADICTED

Current-code evidence:
- Current location: `specs/ENG-361/audit.md`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: changed files include `specs/ENG-361/*`; no `specs/ENG-366` exists in current branch.

Severity: Critical
Final recommendation impact: Critical Gaps
Reason: the PR cannot be requirement-audited honestly when metadata points at a different issue than the implementation artifacts.
Recommended fix: retitle/relink or split the PR so branch, title, body, spec artifacts, and Linear issue align.
Implementation guidance: if the PR is ENG-361, update GitHub/Graphite metadata; if it is ENG-366, move file-workspace artifacts into the branch and link the issue.
Suggested owner: blocked
Shared abstraction/refactor opportunity: stack hygiene.
Footguns and guardrails:
- Do not merge with contradictory issue identity; follow-up agents will fix the wrong thing.
Validation: `gh pr view 563 --json title,body,headRefName,baseRefName`, local spec artifact check.
<!-- /finding:PR563-F1 -->

<!-- finding:PR573-F1 -->
### PR573-F1. Add requirement traceability or split broad payment-schedule replacement PR

Source type: Missing Linear linkage

PR context:
- PR: #573 payment-schedule-replacement, https://github.com/Connorbelez/flapptanstack/pull/573
- Branch: `codex/payment-schedule-replacement` -> `04-30-deal-portal-prod`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/573

Linear context:
- Linked issue: None
- Requirement: None available.
- Requirement status: MISSING

Current-code evidence:
- Current location: None
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: PR body/release notes span payment schedules, admin lawyers, portfolio views, fee administration, deal portal, WorkOS invitations, and checkout.

Severity: Critical
Final recommendation impact: Critical Gaps
Reason: broad accounting/payment/legal changes without Linear traceability are not reviewable to production standard.
Recommended fix: link a parent Linear issue with child acceptance criteria or split by domain.
Implementation guidance: start by enumerating changed domains and assigning each to a Linear owner.
Suggested owner: shared refactor owner
Shared abstraction/refactor opportunity: stack decomposition.
Footguns and guardrails:
- Do not accept release notes as requirements.
Validation: PR metadata contains a valid Linear key and local specs exist.
<!-- /finding:PR573-F1 -->

<!-- finding:PR574-F1 -->
### PR574-F1. Replace temporary admin lawyers surface with requirement-owned system-object path

Source type: Missing Linear linkage

PR context:
- PR: #574 admin-lawyers-management, https://github.com/Connorbelez/flapptanstack/pull/574
- Branch: `codex/admin-lawyers-management` -> `codex/lawyer-onboarding-lso-orchestrator`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/574

Linear context:
- Linked issue: None
- Requirement: None available.
- Requirement status: MISSING

Current-code evidence:
- Current location: `convex/legalRepresentation/adminLawyers.ts`, `src/components/admin/lawyers/AdminLawyersPage.tsx`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: Graphite commit metadata says the implementation is temporary and that lawyers need to become a system object.

Severity: Critical
Final recommendation impact: Critical Gaps
Reason: the PR itself records material tech debt, but there is no Linear issue proving the debt is accepted, bounded, or fixed.
Recommended fix: link/create the issue and migrate or explicitly accept the system-object path.
Implementation guidance: audit `lawyerProfiles`, `lsoLawyers`, admin shell registration, and CRM system-object expectations together.
Suggested owner: shared refactor owner
Shared abstraction/refactor opportunity: canonical legal representation admin model.
Footguns and guardrails:
- Do not duplicate lawyer roster semantics between CRM system objects and legalRepresentation tables without a migration contract.
Validation: linked Linear issue plus targeted admin lawyers and CRM/system-object tests.
<!-- /finding:PR574-F1 -->

<!-- finding:PR577-F1 -->
### PR577-F1. Link broker reassignment flow to Linear and remove temporary codegen workaround

Source type: Missing Linear linkage

PR context:
- PR: #577 Admin lender broker reassignment flow, https://github.com/Connorbelez/flapptanstack/pull/577
- Branch: `05-03-admin-lender-broker-reassignment` -> `codex/admin-fee-management`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/577

Linear context:
- Linked issue: None
- Requirement: None available.
- Requirement status: MISSING

Current-code evidence:
- Current location: `src/components/admin/lenders/BrokerReassignmentDialog.tsx:42`, `convex/admin/lenders/reassignment.ts`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: UI contains a temporary codegen-blocked manual function reference workaround.

Severity: Critical
Final recommendation impact: Critical Gaps
Reason: WorkOS membership transfer and lender reassignment are high-risk auth/accounting-adjacent workflows and require explicit acceptance criteria.
Recommended fix: attach/create the Linear issue and remove the temporary function reference after codegen.
Implementation guidance: verify rollback, stale assignment races, same-broker blocks, role-specific memberships, and WorkOS membership IDs remain covered.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: admin reassignment action pattern.
Footguns and guardrails:
- Do not mutate historical deals, mortgages, ledger entries, portfolio positions, or audit history during reassignment.
Validation: targeted reassignment tests, `bunx convex codegen`, `bun check`, `bun typecheck`.
<!-- /finding:PR577-F1 -->

<!-- finding:PR518-F1 -->
### PR518-F1. Complete ENG-305 manual live-data validation

Source type: Linear requirement

PR context:
- PR: #518 ENG-305 Broker Portal, https://github.com/Connorbelez/flapptanstack/pull/518
- Branch: `eng-305` -> `eng-303-broker-portal`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/518

Linear context:
- Linked issue: ENG-305
- Requirement: production portal landing behavior must be validated against realistic portal data.
- Requirement status: UNVERIFIED

Current-code evidence:
- Current location: `specs/ENG-305/audit.md`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: local audit verdict is `needs manual validation`.

Severity: Medium
Final recommendation impact: Gaps Found
Reason: portal landing behavior remains environment/data-dependent and unverified.
Recommended fix: run the manual live-data validation and persist the result.
Implementation guidance: seed or select an active portal that satisfies the production landing contract.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: None
Footguns and guardrails:
- Do not treat a component render test as proof of active portal data correctness.
Validation: targeted portal route tests plus recorded manual portal smoke.
<!-- /finding:PR518-F1 -->

<!-- finding:PR540-F1 -->
### PR540-F1. Run hosted WorkOS auth validation for lender handoff

Source type: Linear requirement

PR context:
- PR: #540 ENG-306 Broker Portal, https://github.com/Connorbelez/flapptanstack/pull/540
- Branch: `codex/eng-306-lender-handoff` -> `eng-304`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/540

Linear context:
- Linked issue: ENG-306
- Requirement: lender handoff must work through the hosted WorkOS auth path.
- Requirement status: UNVERIFIED

Current-code evidence:
- Current location: `specs/ENG-306/audit.md`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: audit leaves hosted-auth browser round trip as manual-only.

Severity: Medium
Final recommendation impact: Gaps Found
Reason: auth handoff cannot be considered fully proven without exercising the external auth boundary.
Recommended fix: run the WorkOS hosted browser round trip or document equivalent staging evidence.
Implementation guidance: validate route guard timing against Convex auth readiness.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: shared WorkOS validation playbook.
Footguns and guardrails:
- Do not bypass WorkOS with direct Convex user setup for this acceptance check.
Validation: hosted auth smoke plus targeted route tests.
<!-- /finding:PR540-F1 -->

<!-- finding:PR541-F1 -->
### PR541-F1. Close ENG-307 validation caveat

Source type: Linear requirement

PR context:
- PR: #541 ENG-307 Broker Portal - Borrower Financing, https://github.com/Connorbelez/flapptanstack/pull/541
- Branch: `codex/eng-307-borrower-financing-handoff` -> `codex/eng-306-lender-handoff`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/541

Linear context:
- Linked issue: ENG-307
- Requirement: borrower financing route handoff must be validated without relying on unrelated failing suites.
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `specs/ENG-307/audit.md`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: audit records unrelated full-suite failures around validation.

Severity: Medium
Final recommendation impact: Gaps Found
Reason: acceptance evidence is incomplete until unrelated failures are isolated or the targeted gate is rerun cleanly.
Recommended fix: rerun focused route handoff tests and record unrelated suite failures separately.
Implementation guidance: do not expand ENG-307 scope while closing validation.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: None
Footguns and guardrails:
- Avoid marking full-suite failures as resolved unless the output is captured.
Validation: targeted ENG-307 tests plus repo gate status.
<!-- /finding:PR541-F1 -->

<!-- finding:PR535-F1 -->
### PR535-F1. Link marketplace PDF viewer PR to a Linear issue

Source type: Missing Linear linkage

PR context:
- PR: #535 add marketplace pdf viewer, https://github.com/Connorbelez/flapptanstack/pull/535
- Branch: `pdf-viewer` -> `eng-347-deal-closing`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/535

Linear context:
- Linked issue: None
- Requirement: no issue or acceptance criteria discovered.
- Requirement status: MISSING

Current-code evidence:
- Current location: None
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: branch/title/body/commits/discussion contain no `ENG-*` key.

Severity: Critical
Final recommendation impact: Critical Gaps
Reason: public document/PDF access has security and UX implications that require requirement traceability.
Recommended fix: attach or create the Linear issue that owns PDF access, signed URL behavior, public document RBAC, and e2e expectations.
Implementation guidance: audit `convex/listings/publicDocuments.ts` and listing document viewer tests after the issue is linked.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: marketplace document access contract.
Footguns and guardrails:
- Do not assume "public PDF" means unauthenticated access is always valid.
Validation: linked issue plus marketplace public-document tests/e2e.
<!-- /finding:PR535-F1 -->

<!-- finding:PR533-F1 -->
### PR533-F1. Close WorkOS and seeded-environment manual checks

Source type: Linear requirement

PR context:
- PR: #533 Implemented ENG-352, https://github.com/Connorbelez/flapptanstack/pull/533
- Branch: `eng-352` -> `eng-348`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/533

Linear context:
- Linked issue: ENG-352
- Requirement: operational rollout checks must be validated.
- Requirement status: UNVERIFIED

Current-code evidence:
- Current location: `specs/ENG-352/audit.md`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: audit records code readiness but remaining WorkOS/seeded-environment checks.

Severity: Medium
Final recommendation impact: Gaps Found
Reason: WorkOS and seeded environment behavior sits outside unit coverage.
Recommended fix: run the manual checks and update the audit artifact.
Implementation guidance: use the embedded Linear plan as the source because no separate Notion plan exists.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: WorkOS validation checklist.
Footguns and guardrails:
- Do not mark staging/production rollout ready from local tests only.
Validation: recorded manual WorkOS and seeded-environment check results.
<!-- /finding:PR533-F1 -->

<!-- finding:PR536-F1 -->
### PR536-F1. Complete ENG-355 manual validation

Source type: Linear requirement

PR context:
- PR: #536 ENG-355 Mic Portal, https://github.com/Connorbelez/flapptanstack/pull/536
- Branch: `eng-355` -> `codex/eng-354-mic-admin-triage-provisioning`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/536

Linear context:
- Linked issue: ENG-355
- Requirement: MIC portal behavior requires manual validation.
- Requirement status: UNVERIFIED

Current-code evidence:
- Current location: `specs/ENG-355/audit.md`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: audit verdict is `needs manual validation`.

Severity: Medium
Final recommendation impact: Gaps Found
Reason: MIC portal readiness remains partially manual.
Recommended fix: complete and record the manual MIC portal validation.
Implementation guidance: verify role/portal-specific behavior, not just route rendering.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: MIC portal smoke checklist.
Footguns and guardrails:
- Do not use admin route access as a substitute for MIC investor access behavior.
Validation: manual MIC portal smoke plus targeted route tests.
<!-- /finding:PR536-F1 -->

<!-- finding:PR542-F1 -->
### PR542-F1. Add missing ENG-357 audit artifact

Source type: Linear requirement

PR context:
- PR: #542 ENG-357, https://github.com/Connorbelez/flapptanstack/pull/542
- Branch: `04-26-eng-357` -> `eng-356`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/542

Linear context:
- Linked issue: ENG-357
- Requirement: issue completion should have persisted audit/status evidence.
- Requirement status: UNVERIFIED

Current-code evidence:
- Current location: `specs/ENG-357/tasks.md`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: tasks artifact exists, but no `audit.md` or `status.md` was found for ENG-357.

Severity: Medium
Final recommendation impact: Gaps Found
Reason: without an audit artifact, the stack report cannot prove requirement closure.
Recommended fix: run a requirement-ledger audit and persist `specs/ENG-357/audit.md`.
Implementation guidance: compare Linear issue requirements against current code, not only the old PR diff.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: missing-audit cleanup sweep.
Footguns and guardrails:
- Do not backfill an audit by copying task checkboxes.
Validation: `$linear-pr-spec-audit` style artifact for ENG-357.
<!-- /finding:PR542-F1 -->

<!-- finding:PR543-F1 -->
### PR543-F1. Add missing ENG-358 audit artifact and clean invalid issue references

Source type: Linear requirement

PR context:
- PR: #543 ENG-358, https://github.com/Connorbelez/flapptanstack/pull/543
- Branch: `eng-358` -> `04-26-eng-357`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/543

Linear context:
- Linked issue: ENG-358
- Related issues: invalid ENG-526, ENG-529, ENG-530, ENG-531 mentions were found in PR discussion/metadata.
- Requirement: issue completion should have persisted audit/status evidence.
- Requirement status: UNVERIFIED

Current-code evidence:
- Current location: `specs/ENG-358/tasks.md`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: tasks artifact exists, but no `audit.md` or `status.md` was found for ENG-358; several mentioned Linear keys do not exist.

Severity: Medium
Final recommendation impact: Gaps Found
Reason: invalid issue references and missing audit evidence weaken traceability.
Recommended fix: run/persist the ENG-358 audit and correct or remove invalid issue references.
Implementation guidance: verify whether invalid keys are typoed Linear references or external review IDs.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: missing-audit cleanup sweep.
Footguns and guardrails:
- Do not treat invalid Linear keys as related requirements.
Validation: Linear GraphQL lookup and persisted ENG-358 audit artifact.
<!-- /finding:PR543-F1 -->

<!-- finding:PR551-F1 -->
### PR551-F1. Audit mixed-scope ENG-351 PR against explicit requirements

Source type: Linear requirement

PR context:
- PR: #551 ENG-351 + various fixes, https://github.com/Connorbelez/flapptanstack/pull/551
- Branch: `ENG-351` -> `eng-358`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/551

Linear context:
- Linked issue: ENG-351
- Requirement: PR scope should map to the issue requirements and related fixes should be traceable.
- Requirement status: UNVERIFIED

Current-code evidence:
- Current location: `specs/ENG-351/tasks.md`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: title/commit message mix ENG-351 with UI fixes, obligations, payment ops, deal portal stories, and listing detail UI fixes.

Severity: Medium
Final recommendation impact: Gaps Found
Reason: mixed-scope PRs are hard to audit and easy to over-credit.
Recommended fix: produce an audit artifact that separates ENG-351 requirements from opportunistic fixes.
Implementation guidance: if unrelated fixes are still necessary, attach child Linear issues.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: stack scope hygiene.
Footguns and guardrails:
- Do not let unrelated fixes inherit ENG-351 acceptance criteria.
Validation: persisted ENG-351 audit/status artifact.
<!-- /finding:PR551-F1 -->

<!-- finding:PR552-F1 -->
### PR552-F1. Complete ENG-346 e2e and denial-path validation

Source type: Linear requirement

PR context:
- PR: #552 Implemented ENG-346, https://github.com/Connorbelez/flapptanstack/pull/552
- Branch: `eng-346-deal-closing-vertical-terminal` -> `ENG-351`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/552

Linear context:
- Linked issue: ENG-346
- Requirement: admin operations console requires e2e and denial-path validation.
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `specs/ENG-346/audit.md:6`, `specs/ENG-346/audit.md:10`, `specs/ENG-346/status.md:12`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: e2e is blocked by missing `TEST_ACCOUNT_EMAIL`; denial-path execution is unverified.

Severity: Medium
Final recommendation impact: Gaps Found
Reason: admin-facing deal operations need verified auth denial and e2e behavior.
Recommended fix: configure test auth, rerun e2e, and record denial-path results.
Implementation guidance: keep using existing admin route/backend gates; this is validation closure unless tests expose a bug.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: deal-closing e2e setup.
Footguns and guardrails:
- Do not broaden admin access just to simplify tests.
Validation: `bun run test:e2e -- --project=deal-closing`, focused component/view-model tests.
<!-- /finding:PR552-F1 -->

<!-- finding:PR565-F1 -->
### PR565-F1. Complete WorkOS AuthKit callback validation

Source type: Linear requirement

PR context:
- PR: #565 Implemented ENG-362, https://github.com/Connorbelez/flapptanstack/pull/565
- Branch: `eng-362` -> `eng-361-platformlawyer-management`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/565

Linear context:
- Linked issue: ENG-362
- Requirement: hosted WorkOS callback behavior must be validated.
- Requirement status: UNVERIFIED

Current-code evidence:
- Current location: `specs/ENG-362/audit.md`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: audit records hosted callback as manual-only.

Severity: Medium
Final recommendation impact: Gaps Found
Reason: external auth callback behavior cannot be fully proven by local Convex tests.
Recommended fix: run hosted sign-in/sign-up callback validation and update the audit.
Implementation guidance: preserve Convex invitation lifecycle and route fail-closed coverage.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: WorkOS validation checklist.
Footguns and guardrails:
- Do not directly query Convex for auth state in server-side validation.
Validation: hosted WorkOS callback smoke plus existing targeted tests.
<!-- /finding:PR565-F1 -->

<!-- finding:PR575-F1 -->
### PR575-F1. Link lawyer onboarding orchestrator PR to Linear acceptance criteria

Source type: Missing Linear linkage

PR context:
- PR: #575 lawyer-onboarding lso orchestrtor, https://github.com/Connorbelez/flapptanstack/pull/575
- Branch: `codex/lawyer-onboarding-lso-orchestrator` -> `codex/payment-schedule-replacement`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/575

Linear context:
- Linked issue: None
- Requirement: no issue or acceptance criteria discovered.
- Requirement status: MISSING

Current-code evidence:
- Current location: `convex/legalRepresentation/onboarding.ts`, `src/components/legal-representation/LawyerOnboardingPage.tsx`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: PR body describes a major onboarding workflow but no Linear issue key.

Severity: Critical
Final recommendation impact: Critical Gaps
Reason: legal onboarding and WorkOS invitation flows need auditable acceptance criteria.
Recommended fix: attach/create the Linear issue and backfill requirement ledger evidence.
Implementation guidance: include resume behavior, blocked reasons, LSO lookup, invitation idempotency, and route access.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: legal representation onboarding contract.
Footguns and guardrails:
- Do not let UI onboarding completion imply backend entitlement correctness.
Validation: linked issue plus onboarding/LSO registry tests.
<!-- /finding:PR575-F1 -->

<!-- finding:PR576-F1 -->
### PR576-F1. Link admin fee management/accounting changes to Linear

Source type: Missing Linear linkage

PR context:
- PR: #576 admin-fee-management, https://github.com/Connorbelez/flapptanstack/pull/576
- Branch: `codex/admin-fee-management` -> `codex/admin-lawyers-management`
- Graphite: https://app.graphite.com/github/pr/Connorbelez/flapptanstack/576

Linear context:
- Linked issue: None
- Requirement: no issue or acceptance criteria discovered.
- Requirement status: MISSING

Current-code evidence:
- Current location: `convex/fees/assessments.ts`, `convex/dispersal/createDispersalEntries.ts`, `convex/payments/cashLedger/integrations.ts`
- GitNexus: local index current at `956b506`; MCP impact tools unavailable in this thread.
- Local evidence: PR body/release notes cover fee assessment lifecycle, cash ledger integration, bulk operations, and collection rules without a Linear key.

Severity: Critical
Final recommendation impact: Critical Gaps
Reason: accounting/ledger-affecting code needs explicit requirement traceability.
Recommended fix: attach/create the Linear issue and map fee priority, settlement linking, ledger metadata, and opt-out semantics to tests.
Implementation guidance: preserve canonical ledger metadata and replay-stable fee IDs.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: fee/accounting audit contract.
Footguns and guardrails:
- Do not merge fee logic without clear accounting acceptance criteria.
Validation: linked issue plus fee/dispersal/cash-ledger regression suites.
<!-- /finding:PR576-F1 -->

## Cross-PR Synthesis

- The lower stack is mostly disciplined: many PRs have linked Linear issues plus persisted audit/status artifacts and targeted tests.
- The top stack regresses traceability: #573, #575, #574, #576, and #577 are substantial production-domain PRs with no discoverable Linear issue.
- Deal-closing validation blockers repeat across #515, #517, #521, and #552. Treat the dev data/schema issue and e2e auth setup as shared infrastructure work, not four independent feature bugs.
- Mixed-scope PRs (#551, #559, #573) are the main review risk. They make Graphite stack position substitute for product ownership, which is not enough for regulated loan/accounting software.

## Fix Queue

1. PR559-F1 and PR563-F1: resolve stack identity before more agents work on the top stack.
2. PR573-F1, PR575-F1, PR574-F1, PR576-F1, PR577-F1, PR535-F1: add or attach Linear issues and acceptance criteria for all unlinked PRs.
3. PR517-F1 and PR521-F1: fix the shared Convex dev data/schema blocker and rerun targeted e2e.
4. PR515-F1 and PR552-F1: rerun validation/review gates on file-count-safe targets.
5. PR518-F1, PR540-F1, PR541-F1, PR533-F1, PR536-F1, PR565-F1: complete manual WorkOS/portal/MIC validation records.
6. PR542-F1, PR543-F1, PR551-F1: add missing audit artifacts and clean invalid/mixed issue references.
