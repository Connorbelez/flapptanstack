# Stacked PR Review Triage Report

Current branch: `mobilelistingspage`
Analyzed PRs: #577, #576, #574, #575, #573, #572, #568, #567, #565, #563, #559, #561, #552, #551, #543, #542, #539, #536, #538, #537, #533, #521, #516, #535, #517, #515, #519, #511, #541, #540, #520, #518, #512, #524, #523, #534, #532, #514, #510, #513, #509
Generated: 2026-06-10
Report file: `docs/review-triage/stacked-pr-review-triage-2026-06-10.md`

## Executive Summary

- Total comments reviewed: 247 inline review-thread comments, plus 132 top-level PR comments/review submissions.
- Linear issues audited: 39 distinct `ENG-*` references from PR titles, branches, bodies, and local `specs/ENG-*` artifacts.
- Linear requirement gaps: 9 issue-artifact gap signals (`ENG-342`, `ENG-346`, `ENG-347`, `ENG-348`, `ENG-351`, `ENG-357`, `ENG-358`, plus missing local artifacts for `ENG-360` and `ENG-366`).
- Relevant - Needs fix: 17 grouped findings.
- Stale - Still Needs fix, reccomendation out of date: 2 grouped findings.
- Stale - Skip fix: 2 grouped findings.
- Completed: 0 findings implemented by this triage pass.
- Open: 19 actionable grouped findings.
- Blocked: 0.
- Skipped after re-check: 2 grouped findings.
- Highest-risk remaining area: checkout/deal-lock/payment-schedule money movement, followed by legal-representation WorkOS invitation state.
- Recommended parallelization: split into five batches: checkout/payment rails, legal representation/admin lawyers, fees/cash ledger, deal-closing participant workspaces, and route/portal cleanup. Do not split individual money-movement findings across agents.

Notes:
- GitHub still shows 245 unresolved review threads. This report groups duplicates into fix packages instead of creating 245 mechanical rows.
- GitNexus index was stale and was refreshed with `npx gitnexus analyze` before impact checks.
- Subagent dispatch was not used; the parent performed sequential triage using bulk GitHub exports under `/tmp/fairlend-stack-triage-2026-06-10`.

## Linear Issue Coverage

| PR | Linear issue | Review threads | Audit verdict |
| --- | --- | ---: | --- |
| #577 Admin lender broker reassignment flow | not found | 10 | Review-thread gaps found |
| #576 admin-fee-management | not found | 17 | Review-thread gaps found |
| #574 admin-lawyers-management | not found | 14 | Review-thread gaps found |
| #575 lawyer-onboarding lso orchestrtor | not found | 10 | Review-thread gaps found |
| #573 payment-schedule-replacement | not found | 23 | Review-thread gaps found |
| #572 04-30-deal-portal big refactors and cleanup | ENG-365 | 0 | Local audit ready |
| #568 ENG-364 | ENG-364 | 6 | Local audit ready, review gaps found |
| #567 ENG-363 | ENG-363 | 2 | Local audit ready, review gaps found |
| #565 ENG-362 | ENG-362 | 5 | Needs manual validation; review gaps found |
| #563 ENG-366 | ENG-366 | 2 | Local `specs/ENG-366` artifact not present |
| #559 ENG-360 + ENG-351 + ENG-359 | ENG-360, ENG-351, ENG-359 | 3 | ENG-360 artifact missing; ENG-351 task ledger incomplete |
| #561 ENG-359 | ENG-359 | 6 | Local audit ready, review gaps found |
| #552 ENG-346 | ENG-346 | 7 | Needs manual validation; validation tasks unchecked |
| #551 ENG-351 | ENG-351 | 7 | Task ledger still contains unchecked requirements |
| #543 ENG-358 | ENG-358 | 8 | Task ledger still contains unchecked requirements |
| #542 ENG-357 | ENG-357 | 18 | Task ledger still contains unchecked tests |
| #539 ENG-356 | ENG-356 | 2 | Local audit ready, review gaps found |
| #536 ENG-355 | ENG-355 | 2 | Needs manual validation |
| #538 ENG-354 | ENG-354 | 4 | Local audit ready, review gaps found |
| #537 ENG-353 | ENG-353 | 1 | Local audit ready |
| #533 ENG-352 | ENG-352 | 2 | Needs manual validation, no missing/contradicted implementation gaps recorded |
| #521 ENG-348 | ENG-348 | 8 | Audit not ready; participant-workspace requirements unchecked |
| #516 ENG-343 | ENG-343 | 2 | Local audit ready, review gaps found |
| #535 PDF viewer | not found | 2 | Review-thread gaps found |
| #517 ENG-347 | ENG-347 | 16 | Implementation findings resolved, E2E blocked, checklist still has unchecked auth/access requirements |
| #515 ENG-342 | ENG-342 | 3 | Audit not ready |
| #519 ENG-341 + ENG-276 + ENG-301 + ENG-302 | ENG-341, ENG-276, ENG-301, ENG-302 | 2 | ENG-341 ready; older linked issues have stale/partial artifacts |
| #511 ENG-338 | ENG-338 | 1 | Local audit ready, review gap found |
| #541 ENG-307 | ENG-307 | 6 | Needs manual validation; route/form review gaps found |
| #540 ENG-306 | ENG-306 | 3 | Needs manual validation; route/security review gaps found |
| #520 ENG-304 | ENG-304 | 5 | Local audit ready, review gaps found |
| #518 ENG-305 | ENG-305 | 1 | Needs manual validation, review gap found |
| #512 ENG-303 + ENG-333 + ENG-336 | ENG-303, ENG-333, ENG-336 | 1 | ENG-303/333 ready; ENG-336 needs manual validation |
| #524 ENG-345 | ENG-345 | 3 | Local audit ready, review gaps found |
| #523 ENG-344 | ENG-344 | 2 | Local audit ready, review gaps found |
| #534 ENG-350 | ENG-350 | 4 | Local audit ready, review gaps found |
| #532 ENG-349 | ENG-349 | 14 | Local audit ready, review gaps found |
| #514 checkout start | not found | 11 | Review-thread gaps found |
| #510 ENG-339 | ENG-339 | 7 | Local audit ready, review gaps found |
| #513 ENG-335 | ENG-335 | 2 | Local audit ready, review gaps found |
| #509 ENG-337 | ENG-337 | 5 | Local audit ready, one stale route finding |

Production-quality concerns found across Linear artifacts:
- `ENG-342`, `ENG-348`: audit verdict `not ready`.
- `ENG-346`, `ENG-347`, `ENG-351`, `ENG-357`, `ENG-358`: unchecked validation/test/acceptance tasks remain in local artifacts.
- `ENG-360`, `ENG-366`: no local `specs/ENG-*` directory was present for audit evidence.

## Manifest

### PR #577: Admin lender broker reassignment flow

Linear issue: not found

<!-- manifest:PR577-F1 -->
- [ ] PR577-F1: Lender reassignment still uses broker org context for WorkOS membership decisions
  - Status: open
  - Source: Review thread
  - Verdict: Relevant - Needs fix
  - Priority: P1
  - Current files/lines: `convex/admin/lenders/reassignment.ts`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/577#discussion_r3178819901, https://github.com/Connorbelez/flapptanstack/pull/577#discussion_r3192111974, https://github.com/Connorbelez/flapptanstack/pull/577#discussion_r3192111976
  - Recommended fix: Drive old-membership lookup and org-change detection from the lender canonical org, not the current broker row.
  - Parallelization: batch with PR574-F1 if touching WorkOS helper abstractions
<!-- /manifest:PR577-F1 -->

### PR #576: admin-fee-management

Linear issue: not found

<!-- manifest:PR576-F1 -->
- [ ] PR576-F1: Fee assessment lifecycle and summaries bypass fee validity and governed transitions
  - Status: open
  - Source: Review thread
  - Verdict: Relevant - Needs fix
  - Priority: P1
  - Current files/lines: `convex/fees/assessments.ts:11`, `convex/fees/config.ts:52`, `convex/fees/config.ts:371`, `convex/fees/queries.ts:160`, `convex/fees/resolver.ts:192`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/576#discussion_r3192140743, https://github.com/Connorbelez/flapptanstack/pull/576#discussion_r3192140760, https://github.com/Connorbelez/flapptanstack/pull/576#discussion_r3192140761, https://github.com/Connorbelez/flapptanstack/pull/576#discussion_r3192140766, https://github.com/Connorbelez/flapptanstack/pull/576#discussion_r3192140768
  - Recommended fix: Centralize mortgage-fee applicability checks and route fee-assessment status changes through a governed transition/audit path.
  - Parallelization: batch with PR576-F2
<!-- /manifest:PR576-F1 -->

<!-- manifest:PR576-F2 -->
- [ ] PR576-F2: Servicing-fee settlement and reversal can leave cash-ledger/assessment state inconsistent
  - Status: open
  - Source: Review thread
  - Verdict: Relevant - Needs fix
  - Priority: P0
  - Current files/lines: `convex/payments/cashLedger/integrations.ts:686`, `convex/payments/cashLedger/integrations.ts:853`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/576#discussion_r3192140775, https://github.com/Connorbelez/flapptanstack/pull/576#discussion_r3192140776
  - Recommended fix: Persist obligation linkage on fee-assessment settlement and ensure reversal reverses all associated servicing entries.
  - Parallelization: batch with PR576-F1
<!-- /manifest:PR576-F2 -->

<!-- manifest:PR576-F3 -->
- [ ] PR576-F3: Fee admin UI has dead-end actions
  - Status: open
  - Source: Review thread
  - Verdict: Relevant - Needs fix
  - Priority: P1
  - Current files/lines: `src/components/admin/fees/bulk-apply-fee-set-panel.tsx`, `src/components/admin/fees/fee-set-form.tsx`, `src/components/admin/fees/mortgage-fee-application-panel.tsx`
  - Original review or requirement: PR #576 review threads on `Preview`, `Save set`, and `Inspect`
  - Recommended fix: Either wire the actions to real mutations/routes or remove/disable them with explicit unavailable state.
  - Parallelization: independent
<!-- /manifest:PR576-F3 -->

### PR #574: admin-lawyers-management

Linear issue: not found

<!-- manifest:PR574-F1 -->
- [ ] PR574-F1: Admin lawyer WorkOS/profile flows have identity, race, and audit-evidence gaps
  - Status: open
  - Source: Review thread
  - Verdict: Relevant - Needs fix
  - Priority: P1
  - Current files/lines: `convex/legalRepresentation/adminLawyers.ts`, `convex/legalRepresentation/management.ts`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/574#discussion_r3178427831, https://github.com/Connorbelez/flapptanstack/pull/574#discussion_r3192122180, https://github.com/Connorbelez/flapptanstack/pull/574#discussion_r3192122185, https://github.com/Connorbelez/flapptanstack/pull/574#discussion_r3192122190
  - Recommended fix: Resolve users without a 100-row cap, claim invite delivery before external WorkOS calls, validate caller-provided auth IDs, and hash submitted evidence content.
  - Parallelization: batch with PR575-F1
<!-- /manifest:PR574-F1 -->

<!-- manifest:PR574-F2 -->
- [ ] PR574-F2: Admin lawyer detail dialogs use local heuristics for deal/action state
  - Status: open
  - Source: Review thread
  - Verdict: Relevant - Needs fix
  - Priority: P1
  - Current files/lines: `src/components/admin/lawyers/AdminLawyersDetailSheet.tsx`, `src/components/admin/lawyers/InvitePlatformLawyerDialog.tsx`
  - Original review or requirement: PR #574 review threads on `primaryDeal`, local sheet state, and invite dialog close behavior
  - Recommended fix: Bind actions to explicit deal IDs from server projection and reset/await dialog mutations before closing.
  - Parallelization: independent after PR574-F1 projection shape is settled
<!-- /manifest:PR574-F2 -->

### PR #575 and PR #565: lawyer onboarding and invitation handling

Linear issue: ENG-362, plus unlinked lawyer-onboarding PR review context

<!-- manifest:PR575-F1 -->
- [ ] PR575-F1: WorkOS invitation token resolution mutates onboarding state and inconsistent invitation status guards remain
  - Status: open
  - Source: Review thread
  - Verdict: Stale - Still Needs fix, reccomendation out of date
  - Priority: P1
  - Current files/lines: `convex/legalRepresentation/workosInvitations.ts:323`, `convex/legalRepresentation/invitations.ts:638`, `convex/legalRepresentation/invitations.ts:733`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/575#discussion_r3192119083, https://github.com/Connorbelez/flapptanstack/pull/575#discussion_r3192119077, https://github.com/Connorbelez/flapptanstack/pull/573#discussion_r3178355686
  - Recommended fix: Keep token lookup read-only; move start/resume to explicit authenticated accept action; apply the same verified/revoked guard set to both WorkOS accept paths.
  - Parallelization: batch with PR574-F1
<!-- /manifest:PR575-F1 -->

<!-- manifest:PR575-F2 -->
- [ ] PR575-F2: Lawyer onboarding route still subscribes before Convex auth readiness
  - Status: open
  - Source: Review thread
  - Verdict: Relevant - Needs fix
  - Priority: P1
  - Current files/lines: `src/routes/lawyer/onboarding.$sessionId.tsx:34`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/575#discussion_r3178778248
  - Recommended fix: Move the suspense query into a child rendered under a parent `Authenticated`/`AuthLoading` layout, matching `src/routes/listings/route.tsx`.
  - Parallelization: batch with PR573-F1
<!-- /manifest:PR575-F2 -->

### PR #573, #519, #523, #532, #514, #524, #510: checkout, locks, webhooks, and payment schedules

Linear issue: ENG-341, ENG-344, ENG-345, ENG-349, ENG-339 where linked

<!-- manifest:PR573-F1 -->
- [ ] PR573-F1: Deal portal route still subscribes before Convex auth readiness
  - Status: open
  - Source: Review thread
  - Verdict: Relevant - Needs fix
  - Priority: P1
  - Current files/lines: `src/routes/deals/$dealId.tsx:31`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/573#discussion_r3178355683
  - Recommended fix: Split `/deals/$dealId` into an authenticated parent wrapper plus child suspense-query component.
  - Parallelization: batch with PR575-F2
<!-- /manifest:PR573-F1 -->

<!-- manifest:PR573-F2 -->
- [ ] PR573-F2: Deal-lock checkout persists seller lender ID as seller auth ID and skips portal constraints when portalId is absent
  - Status: open
  - Source: Review thread
  - Verdict: Relevant - Needs fix
  - Priority: P0
  - Current files/lines: `convex/dealLocks/mutations.ts:92`, `convex/dealLocks/mutations.ts:348`, `convex/dealLocks/mutations.ts:382`, `convex/dealLocks/mutations.ts:563`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/573#discussion_r3178372799, https://github.com/Connorbelez/flapptanstack/pull/519#discussion_r3142164194, https://github.com/Connorbelez/flapptanstack/pull/519#discussion_r3142164195
  - Recommended fix: Persist seller auth/user identity separately from lender row ID, require portal context for marketplace visibility checks, and make success/deal creation replay-safe across partial failures.
  - Parallelization: batch with PR532-F1
<!-- /manifest:PR573-F2 -->

<!-- manifest:PR573-F3 -->
- [ ] PR573-F3: Provider-managed payment-schedule activation can over-collect the final interest remainder
  - Status: open
  - Source: Review thread
  - Verdict: Relevant - Needs fix
  - Priority: P0
  - Current files/lines: `convex/payments/scheduleReplacement/apply.ts:2360`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/573#discussion_r3178372813
  - Recommended fix: Split provider-created schedules or otherwise represent the final remainder so total provider collections equal the generated schedule.
  - Parallelization: independent money-movement owner
<!-- /manifest:PR573-F3 -->

<!-- manifest:PR532-F1 -->
- [ ] PR532-F1: Stripe checkout success/refund handling still has retry and event-classification gaps
  - Status: open
  - Source: Review thread
  - Verdict: Relevant - Needs fix
  - Priority: P0
  - Current files/lines: `convex/payments/webhooks/stripe.ts:70`, `convex/checkout/reconciliation.ts:388`, `convex/checkout/reconciliation.ts:423`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/532#discussion_r3142692858, https://github.com/Connorbelez/flapptanstack/pull/532#discussion_r3142692859, https://github.com/Connorbelez/flapptanstack/pull/532#discussion_r3149084136, https://github.com/Connorbelez/flapptanstack/pull/523#discussion_r3144129897
  - Recommended fix: Do not treat `checkout.session.completed` as settled payment proof; persist retryable refund state after provider refund failures; distinguish replacement-reservation success from later relink/patch failures.
  - Parallelization: batch with PR573-F2
<!-- /manifest:PR532-F1 -->

### PR #521, #517, #515, #511, #516: deal-closing workspaces and Documenso

Linear issue: ENG-348, ENG-347, ENG-342, ENG-338, ENG-343

<!-- manifest:PR521-F1 -->
- [ ] PR521-F1: Participant workspace still has receipt, signing-token, and viewer-context gaps
  - Status: open
  - Source: Review thread / Linear requirement
  - Verdict: Relevant - Needs fix
  - Priority: P0
  - Current files/lines: `convex/deals/queries.ts`, `src/components/deals/participant/ParticipantDealWorkspacePage.tsx`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/521#discussion_r3168518886, https://github.com/Connorbelez/flapptanstack/pull/521#discussion_r3168518910, https://github.com/Connorbelez/flapptanstack/pull/521#discussion_r3168518918; `specs/ENG-348/audit.md` verdict `not ready`
  - Recommended fix: Use newest archive row only for receipt evidence, pass viewer context into package surface reads, and exchange opaque signing tokens through a real sign-flow action/URL handoff.
  - Parallelization: shared deal-closing owner
<!-- /manifest:PR521-F1 -->

<!-- manifest:PR515-F1 -->
- [ ] PR515-F1: Documenso webhook parsing still risks missing nested provider identifiers and terminal-event ordering
  - Status: open
  - Source: Review thread / Linear requirement
  - Verdict: Relevant - Needs fix
  - Priority: P1
  - Current files/lines: `convex/deals/envelopeWebhooks.ts`
  - Original review or requirement: PR #515 review threads; `specs/ENG-342/audit.md` verdict `not ready`
  - Recommended fix: Parse provider IDs from nested webhook payloads, read secret headers before verification, and avoid completion reconciliation after terminal failure events.
  - Parallelization: independent backend owner
<!-- /manifest:PR515-F1 -->

### PR #541, #542, #543, #536: route tree and MIC route comments

Linear issue: ENG-307, ENG-357, ENG-358, ENG-355

<!-- manifest:PR541-F1 -->
- [ ] PR541-F1: Borrower financing draft form can still submit a native POST
  - Status: open
  - Source: Review thread
  - Verdict: Relevant - Needs fix
  - Priority: P1
  - Current files/lines: `src/components/borrower/financing/BorrowerFinancingApplicationPage.tsx`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/541#discussion_r3182495413
  - Recommended fix: Remove native `method="post"` or intercept submit until a real route/server action exists.
  - Parallelization: independent frontend owner
<!-- /manifest:PR541-F1 -->

<!-- manifest:PR541-F2 -->
- [ ] PR541-F2: Generated route-tree conflict comments are stale in current branch
  - Status: open
  - Source: Review thread
  - Verdict: Stale - Skip fix
  - Priority: P0
  - Current files/lines: `src/routeTree.gen.ts`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/542#discussion_r3156446099, https://github.com/Connorbelez/flapptanstack/pull/536#discussion_r3169708251, https://github.com/Connorbelez/flapptanstack/pull/541#discussion_r3182495427
  - Recommended fix: None. Current `rg -n "<<<<<<<|=======|>>>>>>>" src/routeTree.gen.ts src/routes` returns no conflict markers.
  - Parallelization: skip
<!-- /manifest:PR541-F2 -->

### PR #540, #520, #518, #512: portal landing and portal security

Linear issue: ENG-306, ENG-304, ENG-305, ENG-303

<!-- manifest:PR540-F1 -->
- [ ] PR540-F1: Lender CTA and entry-path validation still need portal-safe gating
  - Status: open
  - Source: Review thread
  - Verdict: Relevant - Needs fix
  - Priority: P1
  - Current files/lines: `convex/portals/queries.ts`, `convex/onboarding/lenderLanding.ts`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/540#discussion_r3144414616, https://github.com/Connorbelez/flapptanstack/pull/540#discussion_r3144413917, https://github.com/Connorbelez/flapptanstack/pull/540#discussion_r3144415242
  - Recommended fix: Gate lender handoff CTA to broker-attributed portals and constrain accepted entry-path query params/origins.
  - Parallelization: batch with PR512-F1 if touching portal validators
<!-- /manifest:PR540-F1 -->

<!-- manifest:PR512-F1 -->
- [ ] PR512-F1: Portal landing href validator still accepts backslash external-link bypasses
  - Status: open
  - Source: Review thread
  - Verdict: Relevant - Needs fix
  - Priority: P1
  - Current files/lines: `convex/portals/validators.ts:358`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/512#discussion_r3142177339
  - Recommended fix: Reject backslashes in stored portal landing hrefs before browser URL normalization can reinterpret them as path separators.
  - Parallelization: batch with PR540-F1
<!-- /manifest:PR512-F1 -->

### PR #513 and #509: Velocity

Linear issue: ENG-335, ENG-337

<!-- manifest:PR513-F1 -->
- [ ] PR513-F1: Velocity test harness setup and failure mutation need environment hardening
  - Status: open
  - Source: Review thread
  - Verdict: Relevant - Needs fix
  - Priority: P1
  - Current files/lines: `playwright.config.ts`, `convex/test/velocityE2e.ts`
  - Original review or requirement: PR #513 review threads
  - Recommended fix: Exclude Velocity auth setup from shared setup matching and gate test-only failure mutation outside non-test environments.
  - Parallelization: independent
<!-- /manifest:PR513-F1 -->

<!-- manifest:PR509-F1 -->
- [ ] PR509-F1: Velocity loanCode patch route comment is stale
  - Status: open
  - Source: Review thread
  - Verdict: Stale - Skip fix
  - Priority: P1
  - Current files/lines: `convex/http.ts:89`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/509#discussion_r3139996553, https://github.com/Connorbelez/flapptanstack/pull/509#discussion_r3183375616
  - Recommended fix: None. Current code registers `pathPrefix: "/api/dev/mock-velocity/deals/"`.
  - Parallelization: skip
<!-- /manifest:PR509-F1 -->

### Cross-PR artifacts and stale generated-output comments

Linear issue: not found

<!-- manifest:XPR-F1 -->
- [ ] XPR-F1: `.superpowers` runtime artifact comments are partly stale but tracked artifacts remain
  - Status: open
  - Source: Cross-PR synthesis
  - Verdict: Stale - Still Needs fix, reccomendation out of date
  - Priority: P2
  - Current files/lines: `.gitignore:32`, `.superpowers/brainstorm/18570-1777767946/state/server-info`, `.superpowers/verification/admin-lawyers/README.md`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/573#discussion_r3178372789, https://github.com/Connorbelez/flapptanstack/pull/573#discussion_r3178372790
  - Recommended fix: Remove currently tracked `.superpowers` artifacts from Git. The original `server.pid`/`server-stopped` files are gone and `.superpowers/` is now ignored.
  - Parallelization: independent
<!-- /manifest:XPR-F1 -->

## Findings

<!-- finding:PR577-F1 -->
### PR577-F1. Lender reassignment still uses broker org context for WorkOS membership decisions

Source type: Review thread

Original review:
- PR: #577 Admin lender broker reassignment flow
- Reviewer: chatgpt-codex-connector, coderabbitai
- Location: `convex/admin/lenders/reassignment.ts`
- Comment: old membership removal and org-change detection should use the lender's canonical org, not the current broker row.

Linear requirement:
- Issue: None found
- Requirement: None
- Requirement status: None

Current-code evidence:
- Current location: `convex/admin/lenders/reassignment.ts`
- GitNexus: not sampled for this symbol; current file remains in stack head.
- Local evidence: three unresolved review threads target the same reassignment invariant.

Verdict: Relevant - Needs fix
Reason: WorkOS membership side effects are external and stateful; using broker org metadata can remove the wrong membership or miss an org transition.
Recommended update: None
Additional comments: Keep FairLend admin super-permission separate from explicit FairLend staff boundary checks.
Recommended fix: Resolve previous membership from lender canonical org data, compute org change from lender org, and add regression tests for broker row without orgId.
Implementation guidance: Inspect `removeCurrentMembership`, preview summary construction, and commit action. Add tests for reassignment from broker with missing org and FairLend-owned target.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: WorkOS org membership resolver shared with admin-lawyer provisioning.
Footguns and guardrails:
- Do not trust optional broker `orgId` when lender has canonical organization identity.
- External WorkOS calls must be idempotent and preview/commit must agree.
Validation: `bun run test -- convex/admin/lenders src/test/admin/lender-broker-reassignment-dialog.test.tsx`

Implementation notes:
- None yet
<!-- /finding:PR577-F1 -->

<!-- finding:PR576-F1 -->
### PR576-F1. Fee assessment lifecycle and summaries bypass fee validity and governed transitions

Source type: Review thread

Original review:
- PR: #576 admin-fee-management
- Reviewer: coderabbitai
- Location: `convex/fees/assessments.ts`, `convex/fees/config.ts`, `convex/fees/queries.ts`, `convex/fees/resolver.ts`
- Comment: fee assessment creation/manual application should reject inactive, opted-out, and out-of-window fees; summaries should not count reversed settlement as income; status writes should be governed.

Linear requirement:
- Issue: None found
- Requirement: auditability and governed status transitions from repository architecture rules
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `convex/fees/assessments.ts:11`, `convex/fees/config.ts:52`, `convex/fees/config.ts:371`, `convex/fees/queries.ts:160`, `convex/fees/resolver.ts:192`
- GitNexus: `createFeeAssessment` impact returned LOW, no direct upstream callers discovered; this is likely endpoint-style Convex export under-representation.
- Local evidence: current `createFeeAssessment` inserts `status: "assessed"` directly; manual application normalizes fee but does not check active/effective/opt-out; income totals add `settled` before excluding reversed assessments.

Verdict: Relevant - Needs fix
Reason: The comments still match current code and affect accounting correctness.
Recommended update: None
Additional comments: The fix should be in shared fee applicability logic, not scattered local checks.
Recommended fix: Add `assertMortgageFeeAssessable` and governed assessment transition helpers; use them from create/manual apply/settle/reverse paths.
Implementation guidance: Update fee tests to cover inactive, future, expired, opted-out, reversed income, recurring legacy behavior, and borrower primary-link absence.
Suggested owner: shared refactor owner
Shared abstraction/refactor opportunity: Fee lifecycle policy module under `convex/fees/`.
Footguns and guardrails:
- Do not infer `defaultApplication` only from template IDs if imported legacy rows have explicit scope.
- Do not fall back to arbitrary `links[0]` borrower for charges.
Validation: `bun run test -- convex/fees convex/payments/cashLedger`

Implementation notes:
- None yet
<!-- /finding:PR576-F1 -->

<!-- finding:PR576-F2 -->
### PR576-F2. Servicing-fee settlement and reversal can leave cash-ledger/assessment state inconsistent

Source type: Review thread

Original review:
- PR: #576 admin-fee-management
- Reviewer: coderabbitai
- Location: `convex/payments/cashLedger/integrations.ts`
- Comment: settlement should preserve obligation links and reversal should not leave extra servicing entries behind.

Linear requirement:
- Issue: None found
- Requirement: ledger auditability and reversible accounting state
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `convex/payments/cashLedger/integrations.ts:686`, `convex/payments/cashLedger/integrations.ts:853`
- GitNexus: query for fee settlement/cash ledger found `convex/payments/cashLedger/integrations.ts`; no high-risk callgraph warning emitted.
- Local evidence: settlement patches assessment journal fields but does not persist obligation link in the patch shown; allocation can post multiple servicing entries and only returns arrays while reversal concern remains unresolved.

Verdict: Relevant - Needs fix
Reason: Accounting reversals must be complete and replay-safe.
Recommended update: None
Additional comments: Treat this as money-movement P0 even if callgraph breadth is low.
Recommended fix: Persist source obligation link on assessment settlement and reverse all servicing fee journal entries associated with an allocation group.
Implementation guidance: Add regression tests for multi-fee allocation and reversal with multiple servicing entries.
Suggested owner: shared refactor owner
Shared abstraction/refactor opportunity: Canonical servicing-fee allocation record linking assessments, obligations, and journal entries.
Footguns and guardrails:
- Do not rely on `servicingFeeJournalEntryIds[0]` when multiple fees are present.
Validation: `bun run test -- convex/payments/cashLedger convex/fees`

Implementation notes:
- None yet
<!-- /finding:PR576-F2 -->

<!-- finding:PR576-F3 -->
### PR576-F3. Fee admin UI has dead-end actions

Source type: Review thread

Original review:
- PR: #576 admin-fee-management
- Reviewer: coderabbitai
- Location: admin fee UI panels
- Comment: `Preview`, `Save set`, and `Inspect` render as actions but are not functional.

Linear requirement:
- Issue: None found
- Requirement: production-quality admin flow
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `src/components/admin/fees/*`
- GitNexus: not sampled; UI actions are leaf components.
- Local evidence: unresolved review threads remain and no later evidence showed those actions wired.

Verdict: Relevant - Needs fix
Reason: Admin affordances that do nothing create operational ambiguity in fee management.
Recommended update: None
Additional comments: Prefer disabling with explicit state over fake success.
Recommended fix: Wire actions to real mutation/query flows or remove them until supported.
Implementation guidance: Add component tests asserting action behavior.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: Admin fee command surface model.
Footguns and guardrails:
- Do not create frontend-only previews if backend applies different fee validity rules.
Validation: `bun run test -- src/test/admin src/components/admin/fees`

Implementation notes:
- None yet
<!-- /finding:PR576-F3 -->

<!-- finding:PR574-F1 -->
### PR574-F1. Admin lawyer WorkOS/profile flows have identity, race, and audit-evidence gaps

Source type: Review thread

Original review:
- PR: #574 admin-lawyers-management
- Reviewer: chatgpt-codex-connector, coderabbitai
- Location: `convex/legalRepresentation/adminLawyers.ts`, `convex/legalRepresentation/management.ts`
- Comment: email lookup caps, invite delivery race, caller-supplied auth IDs, and fake evidence digests are unsafe.

Linear requirement:
- Issue: None found
- Requirement: WorkOS identity correctness and auditability
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `convex/legalRepresentation/adminLawyers.ts`, `convex/legalRepresentation/management.ts`
- GitNexus: query for legal representation invitation flows identified legal-representation definitions; sampled `resolveWorkosInvitationToken` impact LOW due endpoint-style export.
- Local evidence: unresolved P1 review threads remain; no later review closure in GitHub.

Verdict: Relevant - Needs fix
Reason: Admin lawyer onboarding writes identity and verification state; accepting partial identity evidence is a privilege boundary issue.
Recommended update: None
Additional comments: Reuse the same normalization/identity policy across guest and platform lawyer flows.
Recommended fix: Replace capped email search with indexed or paginated lookup, claim delivery before WorkOS send, validate auth IDs against WorkOS identity, and hash evidence content with real SHA-256.
Implementation guidance: Add race/idempotency tests for duplicate invite action invocations and auth mismatch tests.
Suggested owner: shared refactor owner
Shared abstraction/refactor opportunity: WorkOS invitation claim/delivery helper.
Footguns and guardrails:
- External send after local pending read creates a double-send window.
- Audit evidence digests must be content-derived, not formatted labels.
Validation: `bun run test -- convex/legalRepresentation src/test/admin`

Implementation notes:
- None yet
<!-- /finding:PR574-F1 -->

<!-- finding:PR574-F2 -->
### PR574-F2. Admin lawyer detail dialogs use local heuristics for deal/action state

Source type: Review thread

Original review:
- PR: #574 admin-lawyers-management
- Reviewer: chatgpt-codex-connector, coderabbitai
- Location: `src/components/admin/lawyers/AdminLawyersDetailSheet.tsx`, `src/components/admin/lawyers/InvitePlatformLawyerDialog.tsx`
- Comment: sheet picks `active[0] ?? recent[0]`, stale local state can survive close/switch, and invite dialog closes before mutation completion.

Linear requirement:
- Issue: None found
- Requirement: admin action correctness
- Requirement status: PARTIAL

Current-code evidence:
- Current location: admin lawyer components still exist.
- GitNexus: not sampled; leaf UI.
- Local evidence: unresolved P1 review threads remain.

Verdict: Relevant - Needs fix
Reason: Admin actions must target the intended deal/profile, not a local heuristic.
Recommended update: None
Additional comments: Server projections should expose available action targets.
Recommended fix: Bind actions to explicit server-projected deal/action IDs and reset/await dialog state.
Implementation guidance: Add RTL tests for switch lawyer, close/reopen, and failed invite mutation.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: Admin lawyer action target model.
Footguns and guardrails:
- Do not infer action target from array ordering.
Validation: `bun run test -- src/test/admin`

Implementation notes:
- None yet
<!-- /finding:PR574-F2 -->

<!-- finding:PR575-F1 -->
### PR575-F1. WorkOS invitation token resolution mutates onboarding state and inconsistent invitation status guards remain

Source type: Review thread

Original review:
- PR: #575 lawyer-onboarding lso orchestrtor and #573 payment-schedule-replacement
- Reviewer: chatgpt-codex-connector, coderabbitai
- Location: `convex/legalRepresentation/workosInvitations.ts`, `convex/legalRepresentation/invitations.ts`
- Comment: token lookup should not start/resume onboarding, and WorkOS accept paths should guard verified/revoked invitations consistently.

Linear requirement:
- Issue: ENG-362
- Requirement: invitation acceptance and identity resolution fail closed
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `convex/legalRepresentation/workosInvitations.ts:323`, `convex/legalRepresentation/invitations.ts:638`, `convex/legalRepresentation/invitations.ts:733`
- GitNexus: `resolveWorkosInvitationToken` impact LOW, no upstream callers; endpoint export likely not represented as runtime usage.
- Local evidence: current token resolver calls `startOrResumeForInvitationInternal`; `acceptGuestInvitationByWorkosInvitationInternal` guards verified/revoked, but `acceptWorkosInvitationForOnboardingInternal` does not.

Verdict: Stale - Still Needs fix, reccomendation out of date
Reason: Some status-guard work landed in one accept path, but the underlying read-only lookup and parity issues remain.
Recommended update: Apply guard parity to current function names and move onboarding mutation to explicit accept action.
Additional comments: `specs/ENG-362/audit.md` says needs manual validation, no material implementation gaps after resend/revoke coverage; this review identifies a remaining production-hardening gap in current code.
Recommended fix: Make `resolveWorkosInvitationToken` read-only and return local invitation status/route hints only.
Implementation guidance: Add tests for link scanner lookup, verified token lookup, revoked token lookup, and explicit accept transition.
Suggested owner: shared refactor owner
Shared abstraction/refactor opportunity: Invitation state machine helper.
Footguns and guardrails:
- Email link scanners must not mutate onboarding state.
- Keep guest and platform invitation semantics separate.
Validation: `bun run test -- convex/legalRepresentation`

Implementation notes:
- None yet
<!-- /finding:PR575-F1 -->

<!-- finding:PR575-F2 -->
### PR575-F2. Lawyer onboarding route still subscribes before Convex auth readiness

Source type: Review thread

Original review:
- PR: #575 lawyer-onboarding lso orchestrtor
- Reviewer: chatgpt-codex-connector
- Location: `src/routes/lawyer/onboarding.$sessionId.tsx`
- Comment: protected Convex query runs before `Authenticated`/`AuthLoading` wrapper can gate rendering.

Linear requirement:
- Issue: ENG-347/ENG-362 auth wrapper pattern in repo docs
- Requirement: authenticated route trees that render suspense queries must gate with `Authenticated`/`AuthLoading` before child outlet
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `src/routes/lawyer/onboarding.$sessionId.tsx:34`
- GitNexus: not sampled; route component.
- Local evidence: current component calls `useSuspenseQuery` at line 36 before returning local `<Authenticated>` branch.

Verdict: Relevant - Needs fix
Reason: The local wrapper is too late; hook subscription has already happened.
Recommended update: None
Additional comments: Follow `src/routes/listings/route.tsx`.
Recommended fix: Introduce a parent route/layout wrapper or child component under the existing lawyer authenticated layout.
Implementation guidance: Add route test proving `AuthLoading` does not mount query component.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: Authenticated suspense route template.
Footguns and guardrails:
- `guardAuthenticated()` is not a substitute for Convex auth readiness.
Validation: `bun run test -- src/test/routes src/test/lawyer`

Implementation notes:
- None yet
<!-- /finding:PR575-F2 -->

<!-- finding:PR573-F1 -->
### PR573-F1. Deal portal route still subscribes before Convex auth readiness

Source type: Review thread

Original review:
- PR: #573 payment-schedule-replacement
- Reviewer: chatgpt-codex-connector
- Location: `src/routes/deals/$dealId.tsx`
- Comment: protected deal portal query runs before the `Authenticated` guard.

Linear requirement:
- Issue: ENG-348 route/auth requirement
- Requirement: authenticated route trees with suspense queries must use parent auth wrapper
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `src/routes/deals/$dealId.tsx:31`
- GitNexus: query for participant workspace found `ParticipantDealWorkspacePage` execution flow.
- Local evidence: current component calls `useSuspenseQuery` at line 33 before rendering `Authenticated`.

Verdict: Relevant - Needs fix
Reason: Same auth readiness bug remains in current branch.
Recommended update: None
Additional comments: Batch with PR575-F2 for a shared route pattern.
Recommended fix: Split into authenticated parent layout and child outlet/content route.
Implementation guidance: Mirror tests from `src/test/routes/listings-route.test.tsx`.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: Authenticated suspense route template.
Footguns and guardrails:
- Do not mount suspense query screens directly under an authenticated route without wrapper.
Validation: `bun run test -- src/test/routes/deal-portal-route.test.tsx`

Implementation notes:
- None yet
<!-- /finding:PR573-F1 -->

<!-- finding:PR573-F2 -->
### PR573-F2. Deal-lock checkout persists seller lender ID as seller auth ID and skips portal constraints when portalId is absent

Source type: Review thread

Original review:
- PR: #573 and #519
- Reviewer: chatgpt-codex-connector
- Location: `convex/dealLocks/mutations.ts`
- Comment: seller auth ID is assigned from seller lot lender ID; portal visibility checks return early when portalId is absent; success replay is not robust against partial failures.

Linear requirement:
- Issue: ENG-341
- Requirement: deal closing from verified listing-lock checkout preserves actor identity and portal visibility
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `convex/dealLocks/mutations.ts:92`, `convex/dealLocks/mutations.ts:382`, `convex/dealLocks/mutations.ts:563`
- GitNexus: checkout/deal-lock query found `convex/dealLocks/mutations.ts`; no HIGH/CRITICAL callgraph risk emitted.
- Local evidence: current code sets `sellerAuthId: seller.lenderId`; `ensureListingVisibleToBuyer` returns when `portalId` is absent.

Verdict: Relevant - Needs fix
Reason: This is a real identity and access-control bug in current code.
Recommended update: None
Additional comments: Treat as P0 because it writes deal participant identity.
Recommended fix: Resolve seller user/auth identity from seller lot/account/lender relation explicitly, require portal context or fail closed, and add idempotent deal creation recovery.
Implementation guidance: Add tests for missing portal, seller lender vs user ID, replay after deal insert before session patch.
Suggested owner: shared refactor owner
Shared abstraction/refactor opportunity: Checkout participant identity resolver.
Footguns and guardrails:
- `Id<"lenders">` is not a WorkOS auth ID.
- Portal-less checkout visibility should be explicitly allowed only for documented staff/admin path.
Validation: `bun run test -- convex/dealLocks convex/checkout`

Implementation notes:
- None yet
<!-- /finding:PR573-F2 -->

<!-- finding:PR573-F3 -->
### PR573-F3. Provider-managed payment-schedule activation can over-collect the final interest remainder

Source type: Review thread

Original review:
- PR: #573 payment-schedule-replacement
- Reviewer: coderabbitai
- Location: `convex/payments/scheduleReplacement/apply.ts`
- Comment: provider schedule uses the same interest amount for every installment, so a final remainder row can be over-collected.

Linear requirement:
- Issue: payment schedule replacement PR scope
- Requirement: provider-managed schedule must match generated amortization/payment schedule totals
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `convex/payments/scheduleReplacement/apply.ts:2360`
- GitNexus: not sampled; money-movement action path.
- Local evidence: current `provider.createSchedule` receives `amount: begin.draft.interestPaymentAmount` and `installments: begin.draft.interestInstallmentCount`.

Verdict: Relevant - Needs fix
Reason: The exact over-collection pattern remains.
Recommended update: None
Additional comments: This is a money movement P0.
Recommended fix: If Rotessa cannot express variable final installment, create separate provider schedules or keep provider-managed activation disabled for remainder schedules.
Implementation guidance: Add test where total interest does not divide evenly by installment count.
Suggested owner: shared refactor owner
Shared abstraction/refactor opportunity: Provider schedule generation strategy.
Footguns and guardrails:
- Do not round final remainder into every installment.
Validation: `bun run test -- convex/payments/scheduleReplacement`

Implementation notes:
- None yet
<!-- /finding:PR573-F3 -->

<!-- finding:PR532-F1 -->
### PR532-F1. Stripe checkout success/refund handling still has retry and event-classification gaps

Source type: Review thread

Original review:
- PR: #532, #523
- Reviewer: chatgpt-codex-connector, coderabbitai
- Location: `convex/payments/webhooks/stripe.ts`, `convex/checkout/reconciliation.ts`
- Comment: `checkout.session.completed` is not settled payment proof; failed late-success refunds should retry; re-lock catch swallows post-reservation failures.

Linear requirement:
- Issue: ENG-344, ENG-349
- Requirement: checkout reconciliation is idempotent and retry-safe
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `convex/payments/webhooks/stripe.ts:70`, `convex/checkout/reconciliation.ts:388`, `convex/checkout/reconciliation.ts:423`
- GitNexus: `buildLateSuccessRefundRequest` impact LOW, direct caller `reconcileLateSuccess`, depth-2 caller `reconcileSuccess`.
- Local evidence: `extractProviderRef` still defaults to event object ID for unhandled event types; `ensureLateSuccessReservation` catches both reservation and later patch failures together.

Verdict: Relevant - Needs fix
Reason: Replay behavior and payment proof classification remain fragile.
Recommended update: None
Additional comments: Batch with deal-lock identity work to avoid inconsistent checkout state transitions.
Recommended fix: Classify payment-settled events separately from session-completed events; persist refund attempt state before/after provider calls; split replacement reservation creation from session relink/patch catch.
Implementation guidance: Add webhook replay tests for refund provider success + local failure, and session completed without payment intent settlement.
Suggested owner: shared refactor owner
Shared abstraction/refactor opportunity: Checkout reconciliation state machine.
Footguns and guardrails:
- Stripe Checkout session completion is not the same fact as settled cash.
Validation: `bun run test -- convex/checkout convex/payments/webhooks`

Implementation notes:
- None yet
<!-- /finding:PR532-F1 -->

<!-- finding:PR521-F1 -->
### PR521-F1. Participant workspace still has receipt, signing-token, and viewer-context gaps

Source type: Review thread / Linear requirement

Original review:
- PR: #521 ENG-348
- Reviewer: chatgpt-codex-connector
- Location: `convex/deals/queries.ts`, `src/components/deals/participant/ParticipantDealWorkspacePage.tsx`
- Comment: receipt evidence should use newest archive row; document package surface needs viewer context; opaque signing tokens strand users.

Linear requirement:
- Issue: ENG-348
- Requirement: buyer/seller workspace detail projection composes signing task, receipt, package, viewer access, blockers, and timeline
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `convex/deals/queries.ts`, `src/components/deals/participant/ParticipantDealWorkspacePage.tsx`
- GitNexus: query found `ParticipantDealWorkspacePage -> Format` cross-community flow.
- Local evidence: `specs/ENG-348/audit.md` verdict is `not ready`; execution checklist still has unchecked participant queue/workspace requirements.

Verdict: Relevant - Needs fix
Reason: This is both a review-thread gap and a Linear acceptance gap.
Recommended update: None
Additional comments: Do this as one deal-closing projection cleanup rather than one-off UI patches.
Recommended fix: Update projection to newest receipt archive only, thread viewer context to package reads, and expose actionable signing URL/session handoff.
Implementation guidance: Add backend projection tests and RTL workspace tests for signing action.
Suggested owner: shared refactor owner
Shared abstraction/refactor opportunity: Participant document/signing projection contract.
Footguns and guardrails:
- Do not expose package data without viewer-scoped access checks.
Validation: `bun run test -- convex/deals src/test/deals`

Implementation notes:
- None yet
<!-- /finding:PR521-F1 -->

<!-- finding:PR515-F1 -->
### PR515-F1. Documenso webhook parsing still risks missing nested provider identifiers and terminal-event ordering

Source type: Review thread / Linear requirement

Original review:
- PR: #515 ENG-342
- Reviewer: chatgpt-codex-connector
- Location: `convex/deals/envelopeWebhooks.ts`
- Comment: parse nested provider IDs, read secret header before verification, and skip completion reconciliation for terminal failures.

Linear requirement:
- Issue: ENG-342
- Requirement: envelope attempts, webhooks, and signing exceptions
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `convex/deals/envelopeWebhooks.ts`
- GitNexus: not sampled.
- Local evidence: `specs/ENG-342/audit.md` verdict is `not ready`; checklist has unchecked validation tasks.

Verdict: Relevant - Needs fix
Reason: Linear artifact independently confirms this area is not production-complete.
Recommended update: None
Additional comments: The fixer should re-read current webhook code before patching; review line numbers are old.
Recommended fix: Normalize payload extraction for nested Documenso shapes and enforce terminal-event precedence.
Implementation guidance: Add webhook fixture tests for declined/voided/expired and nested recipient/document IDs.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: Documenso webhook event parser.
Footguns and guardrails:
- Do not reconcile completion after terminal failure event.
Validation: `bun run test -- convex/deals`

Implementation notes:
- None yet
<!-- /finding:PR515-F1 -->

<!-- finding:PR541-F1 -->
### PR541-F1. Borrower financing draft form can still submit a native POST

Source type: Review thread

Original review:
- PR: #541 ENG-307
- Reviewer: copilot-pull-request-reviewer, coderabbitai
- Location: `src/components/borrower/financing/BorrowerFinancingApplicationPage.tsx`
- Comment: form has `method="post"` without a route/server action and can full-page POST.

Linear requirement:
- Issue: ENG-307
- Requirement: borrower financing handoff must not navigate to dead native POST path
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `src/components/borrower/financing/BorrowerFinancingApplicationPage.tsx`
- GitNexus: not sampled.
- Local evidence: unresolved duplicate review comments remain; `ENG-307` audit needs manual validation.

Verdict: Relevant - Needs fix
Reason: Native form submission is a user-visible workflow break.
Recommended update: None
Additional comments: If this page is intentionally static, make all CTAs non-submit buttons.
Recommended fix: Add controlled `onSubmit` with `preventDefault` and/or wire TanStack serverFn action.
Implementation guidance: Add RTL test that submit does not call navigation/native post without handler.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: Portal handoff form model.
Footguns and guardrails:
- Buttons inside forms default to submit.
Validation: `bun run test -- src/test/routes src/test/borrower`

Implementation notes:
- None yet
<!-- /finding:PR541-F1 -->

<!-- finding:PR541-F2 -->
### PR541-F2. Generated route-tree conflict comments are stale in current branch

Source type: Review thread

Original review:
- PR: #542, #536, #541
- Reviewer: chatgpt-codex-connector, coderabbitai
- Location: `src/routeTree.gen.ts`
- Comment: generated route tree contained conflict markers or inconsistent entries.

Linear requirement:
- Issue: ENG-307/ENG-357/ENG-355
- Requirement: generated route tree must compile
- Requirement status: SATISFIED for this specific comment

Current-code evidence:
- Current location: `src/routeTree.gen.ts`
- GitNexus: not needed.
- Local evidence: `rg -n "<<<<<<<|=======|>>>>>>>" src/routeTree.gen.ts src/routes` returns no matches.

Verdict: Stale - Skip fix
Reason: Later stacked changes removed conflict markers.
Recommended update: None
Additional comments: Route generation can still be re-run during fixer validation, but this comment itself is stale.
Recommended fix: None
Implementation guidance: None
Suggested owner: skip
Shared abstraction/refactor opportunity: None
Footguns and guardrails:
- If a fixer touches routes, rerun route generation/checks.
Validation: `bun typecheck`

Implementation notes:
- None yet
<!-- /finding:PR541-F2 -->

<!-- finding:PR540-F1 -->
### PR540-F1. Lender CTA and entry-path validation still need portal-safe gating

Source type: Review thread

Original review:
- PR: #540 ENG-306
- Reviewer: chatgpt-codex-connector, copilot-pull-request-reviewer, sourcery-ai
- Location: `convex/portals/queries.ts`, `convex/onboarding/lenderLanding.ts`
- Comment: lender CTA should be broker-attributed and entryPath should reject unsafe/unknown URL state.

Linear requirement:
- Issue: ENG-306
- Requirement: broker landing page lender CTA and onboarding handoff preserve broker attribution
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `convex/portals/queries.ts`, `convex/onboarding/lenderLanding.ts`
- GitNexus: `resolveMicPortalConfig` sampled LOW risk, unrelated but portal-area direct callers shown; no high blast-radius warning.
- Local evidence: unresolved review threads remain; audit needs manual validation.

Verdict: Relevant - Needs fix
Reason: Portal handoff attribution is a tenant boundary.
Recommended update: None
Additional comments: Pair with portal href validator hardening.
Recommended fix: Gate CTA to broker-attributed portals and normalize entry paths against an allowlist of path/query keys.
Implementation guidance: Add tests for absolute URL, malformed URL, extra query params, and non-broker portals.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: Portal navigation target validator.
Footguns and guardrails:
- Do not preserve arbitrary query params into onboarding state.
Validation: `bun run test -- convex/portals convex/onboarding`

Implementation notes:
- None yet
<!-- /finding:PR540-F1 -->

<!-- finding:PR512-F1 -->
### PR512-F1. Portal landing href validator still accepts backslash external-link bypasses

Source type: Review thread

Original review:
- PR: #512 ENG-303
- Reviewer: chatgpt-codex-connector
- Location: `convex/portals/validators.ts`
- Comment: backslashes in safe href regex can be normalized by browsers into external-looking paths.

Linear requirement:
- Issue: ENG-303
- Requirement: stored portal landing links must be safe
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `convex/portals/validators.ts:358`
- GitNexus: not sampled.
- Local evidence: current `SAFE_PORTAL_LANDING_HREF_PATTERN` and related pattern use `[^\s]*`, which does not exclude `\`.

Verdict: Relevant - Needs fix
Reason: Stored link validation is a security boundary.
Recommended update: None
Additional comments: Add explicit `!value.includes("\\")` even if regex is tightened.
Recommended fix: Reject backslashes for all stored portal landing href/link values.
Implementation guidance: Add validator tests for `\/\evil.com`, `/\\evil.com`, and encoded variants if decoded before validation.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: Safe portal URL parser.
Footguns and guardrails:
- Browser URL normalization can differ from regex intent.
Validation: `bun run test -- convex/portals`

Implementation notes:
- None yet
<!-- /finding:PR512-F1 -->

<!-- finding:PR513-F1 -->
### PR513-F1. Velocity test harness setup and failure mutation need environment hardening

Source type: Review thread

Original review:
- PR: #513 ENG-335
- Reviewer: chatgpt-codex-connector
- Location: `playwright.config.ts`, `convex/test/velocityE2e.ts`
- Comment: shared setup project should not match Velocity auth setup, and test failure mutation should be gated outside tests.

Linear requirement:
- Issue: ENG-335
- Requirement: Velocity operator workflow integration and E2E coverage should not leak test-only behavior
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `playwright.config.ts`, `convex/test/velocityE2e.ts`
- GitNexus: `patchVelocityMockDealHttp` impact LOW; Velocity route comment sampled separately is stale.
- Local evidence: unresolved review threads remain.

Verdict: Relevant - Needs fix
Reason: Test-only public mutations and broad auth setup matching can affect unrelated E2E runs.
Recommended update: None
Additional comments: Keep dev/mock Velocity routes isolated.
Recommended fix: Narrow setup glob and add environment/test guard to failure mutation.
Implementation guidance: Run Playwright list or focused Velocity E2E config check.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: E2E setup project naming convention.
Footguns and guardrails:
- Public Convex test helpers must fail closed outside test/dev.
Validation: `bun run test:e2e -- --list`, `bun run test -- src/test/convex/velocity`

Implementation notes:
- None yet
<!-- /finding:PR513-F1 -->

<!-- finding:PR509-F1 -->
### PR509-F1. Velocity loanCode patch route comment is stale

Source type: Review thread

Original review:
- PR: #509 ENG-337
- Reviewer: chatgpt-codex-connector, coderabbitai
- Location: `convex/http.ts`
- Comment: use `pathPrefix` for loanCode suffix routing.

Linear requirement:
- Issue: ENG-337
- Requirement: mock Velocity harness routes support loan-code patching
- Requirement status: SATISFIED for this specific comment

Current-code evidence:
- Current location: `convex/http.ts:89`
- GitNexus: `patchVelocityMockDealHttp` impact LOW.
- Local evidence: current code has both exact `/api/dev/mock-velocity/deals` and `pathPrefix: "/api/dev/mock-velocity/deals/"` route.

Verdict: Stale - Skip fix
Reason: Later code added the requested prefix route.
Recommended update: None
Additional comments: Keep exact route only if intentionally supporting body-based loanCode fallback.
Recommended fix: None
Implementation guidance: None
Suggested owner: skip
Shared abstraction/refactor opportunity: None
Footguns and guardrails:
- None
Validation: `bun run test -- src/test/convex/velocity`

Implementation notes:
- None yet
<!-- /finding:PR509-F1 -->

<!-- finding:XPR-F1 -->
### XPR-F1. `.superpowers` runtime artifact comments are partly stale but tracked artifacts remain

Source type: Cross-PR synthesis

Original review:
- PR: #573 and #551
- Reviewer: coderabbitai
- Location: `.superpowers/brainstorm/...`
- Comment: remove runtime artifacts and ignore `.superpowers/`.

Linear requirement:
- Issue: None
- Requirement: repository hygiene
- Requirement status: PARTIAL

Current-code evidence:
- Current location: `.gitignore:32`, `.superpowers/brainstorm/18570-1777767946/state/server-info`, `.superpowers/verification/admin-lawyers/README.md`
- GitNexus: not needed.
- Local evidence: `.gitignore` now includes `.superpowers/`, and original `server.pid`/`server-stopped` paths are gone, but `git ls-files .superpowers` still shows two tracked files.

Verdict: Stale - Still Needs fix, reccomendation out of date
Reason: Original exact files are stale, but the tracked-artifact class is still real.
Recommended update: Remove currently tracked `.superpowers` files instead of hunting the old PID paths.
Additional comments: This is safe to fix independently.
Recommended fix: `git rm --cached` or delete tracked `.superpowers` artifacts if not intentional project documentation.
Implementation guidance: Confirm no required docs live under `.superpowers/verification/admin-lawyers/README.md` before removal.
Suggested owner: parallel subagent
Shared abstraction/refactor opportunity: None
Footguns and guardrails:
- Ignore rules do not untrack already committed files.
Validation: `git ls-files .superpowers` returns no runtime artifacts.

Implementation notes:
- None yet
<!-- /finding:XPR-F1 -->

## Shared Refactors And Guardrails

- Authenticated suspense routes: batch PR575-F2 and PR573-F1. The canonical pattern is a parent route rendering `Authenticated`/`AuthLoading` before any child component calls `useSuspenseQuery`.
- Money movement: batch PR573-F2, PR573-F3, and PR532-F1 under one owner. These touch checkout identity, Stripe replay/refund semantics, and provider schedule collection amounts.
- Fee accounting: batch PR576-F1 and PR576-F2. Fee validity, assessment lifecycle, settlement linkage, and reversal semantics should share one policy/transition surface.
- Legal representation: batch PR574-F1 and PR575-F1. WorkOS identity, invitation claim/send, token lookup, and status guards should not diverge between guest and platform lawyer flows.
- Portal security: batch PR540-F1 and PR512-F1. CTA attribution and stored href/entryPath validation are both tenant-boundary concerns.

## Fix Queue

1. PR573-F2: identity/access bug in deal-lock checkout.
2. PR573-F3: provider-managed schedule over-collection.
3. PR532-F1: Stripe success/refund replay safety.
4. PR576-F2: cash-ledger servicing-fee reversal consistency.
5. PR576-F1: fee lifecycle validity and governed transitions.
6. PR575-F1 and PR574-F1: WorkOS invitation identity/state hardening.
7. PR573-F1 and PR575-F2: auth-readiness route wrappers.
8. PR521-F1 and PR515-F1: deal-closing workspace/webhook Linear gaps.
9. PR512-F1 and PR540-F1: portal href/CTA safety.
10. Remaining UI/test hygiene: PR576-F3, PR574-F2, PR541-F1, PR513-F1, XPR-F1.
