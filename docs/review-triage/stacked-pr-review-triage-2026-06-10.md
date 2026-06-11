# Stacked PR Review Triage Report

Current branch: `mobilelistingspage`
Analyzed PRs: #577, #576, #574, #575, #573, #572, #568, #567, #565, #563, #559, #561, #552, #551, #543, #542, #539, #536, #538, #537, #533, #521, #516, #535, #517, #515, #519, #511, #541, #540, #520, #518, #512, #524, #523, #534, #532, #514, #510, #513, #509
Generated: 2026-06-10
Report file: `docs/review-triage/stacked-pr-review-triage-2026-06-10.md`

## Executive Summary

- Total comments reviewed: 247 inline review-thread comments, plus 132 top-level PR comments/review submissions.
- Linear issues audited: 39 distinct `ENG-*` references from PR titles, branches, bodies, and local `specs/ENG-*` artifacts.
- Linear requirement gaps: 9 issue-artifact gap signals (`ENG-342`, `ENG-346`, `ENG-347`, `ENG-348`, `ENG-351`, `ENG-357`, `ENG-358`, plus missing local artifacts for `ENG-360` and `ENG-366`).
- Relevant - Needs fix: 0 grouped findings.
- Stale - Still Needs fix, reccomendation out of date: 0 grouped findings.
- Stale - Skip fix: 3 grouped findings.
- Completed: 18 findings implemented by this triage pass.
- Open: 0 actionable grouped findings.
- Blocked: 0.
- Skipped after re-check: 3 grouped findings.
- Highest-risk remaining area: none; all actionable grouped findings in this report are completed or stale-skipped.
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
- [x] PR577-F1: Lender reassignment still uses broker org context for WorkOS membership decisions
  - Status: completed
  - Source: Review thread
  - Verdict: Completed - Fixed
  - Priority: P1
  - Current files/lines: `convex/admin/lenders/reassignment.ts`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/577#discussion_r3178819901, https://github.com/Connorbelez/flapptanstack/pull/577#discussion_r3192111974, https://github.com/Connorbelez/flapptanstack/pull/577#discussion_r3192111976
  - Recommended fix: Drive old-membership lookup and org-change detection from the lender canonical org, not the current broker row.
  - Parallelization: batch with PR574-F1 if touching WorkOS helper abstractions
  - Progress: in progress on 2026-06-10 by `mobilelistingspage` fixer session; scoped to remaining all-findings batch.
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; WorkOS org-change detection and old-membership removal now use the lender canonical org.
<!-- /manifest:PR577-F1 -->

### PR #576: admin-fee-management

Linear issue: not found

<!-- manifest:PR576-F1 -->
- [x] PR576-F1: Fee assessment lifecycle and summaries bypass fee validity and governed transitions
  - Status: completed
  - Source: Review thread
  - Verdict: Completed - Fixed
  - Priority: P1
  - Current files/lines: `convex/fees/assessments.ts:11`, `convex/fees/config.ts:52`, `convex/fees/config.ts:371`, `convex/fees/queries.ts:160`, `convex/fees/resolver.ts:192`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/576#discussion_r3192140743, https://github.com/Connorbelez/flapptanstack/pull/576#discussion_r3192140760, https://github.com/Connorbelez/flapptanstack/pull/576#discussion_r3192140761, https://github.com/Connorbelez/flapptanstack/pull/576#discussion_r3192140766, https://github.com/Connorbelez/flapptanstack/pull/576#discussion_r3192140768
  - Recommended fix: Centralize mortgage-fee applicability checks and route fee-assessment status changes through a governed transition/audit path.
  - Parallelization: batch with PR576-F2
  - Progress: in progress on 2026-06-10 by `mobilelistingspage` fixer session; scoped to PR576-F1.
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; mortgage-fee applicability, primary borrower selection, reversed revenue exclusion, and fee-assessment governed transitions implemented.
<!-- /manifest:PR576-F1 -->

<!-- manifest:PR576-F2 -->
- [x] PR576-F2: Servicing-fee settlement and reversal can leave cash-ledger/assessment state inconsistent
  - Status: completed
  - Source: Review thread
  - Verdict: Completed - Fixed
  - Priority: P0
  - Current files/lines: `convex/payments/cashLedger/integrations.ts:686`, `convex/payments/cashLedger/integrations.ts:853`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/576#discussion_r3192140775, https://github.com/Connorbelez/flapptanstack/pull/576#discussion_r3192140776
  - Recommended fix: Persist obligation linkage on fee-assessment settlement and ensure reversal reverses all associated servicing entries.
  - Parallelization: batch with PR576-F1
  - Progress: in progress on 2026-06-10 by `mobilelistingspage` fixer session; scoped to PR576-F2.
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; assessment obligation linkage and all-entry servicing-fee reversal coverage implemented.
<!-- /manifest:PR576-F2 -->

<!-- manifest:PR576-F3 -->
- [x] PR576-F3: Fee admin UI has dead-end actions
  - Status: completed
  - Source: Review thread
  - Verdict: Completed - Fixed
  - Priority: P1
  - Current files/lines: `src/components/admin/fees/bulk-apply-fee-set-panel.tsx`, `src/components/admin/fees/fee-set-form.tsx`, `src/components/admin/fees/mortgage-fee-application-panel.tsx`
  - Original review or requirement: PR #576 review threads on `Preview`, `Save set`, and `Inspect`
  - Recommended fix: Either wire the actions to real mutations/routes or remove/disable them with explicit unavailable state.
  - Parallelization: independent
  - Progress: in progress on 2026-06-10 by `mobilelistingspage` fixer session; scoped to remaining all-findings batch.
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; unsupported fee admin actions now render disabled explicit unavailable states.
<!-- /manifest:PR576-F3 -->

### PR #574: admin-lawyers-management

Linear issue: not found

<!-- manifest:PR574-F1 -->
- [x] PR574-F1: Admin lawyer WorkOS/profile flows have identity, race, and audit-evidence gaps
  - Status: completed
  - Source: Review thread
  - Verdict: Completed - Fixed
  - Priority: P1
  - Current files/lines: `convex/legalRepresentation/adminLawyers.ts`, `convex/legalRepresentation/management.ts`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/574#discussion_r3178427831, https://github.com/Connorbelez/flapptanstack/pull/574#discussion_r3192122180, https://github.com/Connorbelez/flapptanstack/pull/574#discussion_r3192122185, https://github.com/Connorbelez/flapptanstack/pull/574#discussion_r3192122190
  - Recommended fix: Resolve users without a 100-row cap, claim invite delivery before external WorkOS calls, validate caller-provided auth IDs, and hash submitted evidence content.
  - Parallelization: batch with PR575-F1
  - Progress: in progress on 2026-06-10 by `mobilelistingspage` fixer session; scoped with PR575-F1.
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; synced-user lookup, WorkOS delivery reservation, authId validation, and real evidence hashing implemented.
<!-- /manifest:PR574-F1 -->

<!-- manifest:PR574-F2 -->
- [x] PR574-F2: Admin lawyer detail dialogs use local heuristics for deal/action state
  - Status: completed
  - Source: Review thread
  - Verdict: Completed - Fixed
  - Priority: P1
  - Current files/lines: `src/components/admin/lawyers/AdminLawyersDetailSheet.tsx`, `src/components/admin/lawyers/InvitePlatformLawyerDialog.tsx`
  - Original review or requirement: PR #574 review threads on `primaryDeal`, local sheet state, and invite dialog close behavior
  - Recommended fix: Bind actions to explicit deal IDs from server projection and reset/await dialog mutations before closing.
  - Parallelization: independent after PR574-F1 projection shape is settled
  - Progress: in progress on 2026-06-10 by `mobilelistingspage` fixer session; scoped to remaining all-findings batch.
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; server-projected action target IDs drive detail actions and invite dialog mutations are awaited before close/reset.
<!-- /manifest:PR574-F2 -->

### PR #575 and PR #565: lawyer onboarding and invitation handling

Linear issue: ENG-362, plus unlinked lawyer-onboarding PR review context

<!-- manifest:PR575-F1 -->
- [x] PR575-F1: WorkOS invitation token resolution mutates onboarding state and inconsistent invitation status guards remain
  - Status: completed
  - Source: Review thread
  - Verdict: Completed - Fixed
  - Priority: P1
  - Current files/lines: `convex/legalRepresentation/workosInvitations.ts:323`, `convex/legalRepresentation/invitations.ts:638`, `convex/legalRepresentation/invitations.ts:733`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/575#discussion_r3192119083, https://github.com/Connorbelez/flapptanstack/pull/575#discussion_r3192119077, https://github.com/Connorbelez/flapptanstack/pull/573#discussion_r3178355686
  - Recommended fix: Keep token lookup read-only; move start/resume to explicit authenticated accept action; apply the same verified/revoked guard set to both WorkOS accept paths.
  - Parallelization: batch with PR574-F1
  - Progress: in progress on 2026-06-10 by `mobilelistingspage` fixer session; scoped with PR574-F1.
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; WorkOS token lookup is read-only and guest WorkOS accept paths now return terminal invitation states consistently.
<!-- /manifest:PR575-F1 -->

<!-- manifest:PR575-F2 -->
- [x] PR575-F2: Lawyer onboarding route still subscribes before Convex auth readiness
  - Status: completed
  - Source: Review thread
  - Verdict: Completed - Fixed
  - Priority: P1
  - Current files/lines: `src/routes/lawyer/onboarding.$sessionId.tsx:34`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/575#discussion_r3178778248
  - Recommended fix: Move the suspense query into a child rendered under a parent `Authenticated`/`AuthLoading` layout, matching `src/routes/listings/route.tsx`.
  - Parallelization: batch with PR573-F1
  - Progress: in progress on 2026-06-10 by `mobilelistingspage` fixer session; scoped with PR573-F1.
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; loader prefetch removed and suspense query moved under the Convex auth boundary with regression coverage.
<!-- /manifest:PR575-F2 -->

### PR #573, #519, #523, #532, #514, #524, #510: checkout, locks, webhooks, and payment schedules

Linear issue: ENG-341, ENG-344, ENG-345, ENG-349, ENG-339 where linked

<!-- manifest:PR573-F1 -->
- [x] PR573-F1: Deal portal route still subscribes before Convex auth readiness
  - Status: completed
  - Source: Review thread
  - Verdict: Completed - Fixed
  - Priority: P1
  - Current files/lines: `src/routes/deals/$dealId.tsx:31`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/573#discussion_r3178355683
  - Recommended fix: Split `/deals/$dealId` into an authenticated parent wrapper plus child suspense-query component.
  - Parallelization: batch with PR575-F2
  - Progress: in progress on 2026-06-10 by `mobilelistingspage` fixer session; scoped with PR575-F2.
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; loader prefetch removed and suspense query moved under the Convex auth boundary with regression coverage.
<!-- /manifest:PR573-F1 -->

<!-- manifest:PR573-F2 -->
- [x] PR573-F2: Deal-lock checkout persists seller lender ID as seller auth ID and skips portal constraints when portalId is absent
  - Status: completed
  - Source: Review thread
  - Verdict: Completed - Fixed
  - Priority: P0
  - Current files/lines: `convex/dealLocks/mutations.ts:92`, `convex/dealLocks/mutations.ts:348`, `convex/dealLocks/mutations.ts:382`, `convex/dealLocks/mutations.ts:563`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/573#discussion_r3178372799, https://github.com/Connorbelez/flapptanstack/pull/519#discussion_r3142164194, https://github.com/Connorbelez/flapptanstack/pull/519#discussion_r3142164195
  - Recommended fix: Persist seller auth/user identity separately from lender row ID, require portal context for marketplace visibility checks, and make success/deal creation replay-safe across partial failures.
  - Parallelization: batch with PR532-F1
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; scoped to PR573-F2 only.
<!-- /manifest:PR573-F2 -->

<!-- manifest:PR573-F3 -->
- [ ] PR573-F3: Provider-managed payment-schedule activation can over-collect the final interest remainder
  - Status: skipped-after-recheck
  - Source: Review thread
  - Verdict: Stale - Skip fix
  - Priority: P0
  - Current files/lines: `convex/payments/scheduleReplacement/apply.ts:2360`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/573#discussion_r3178372813
  - Recommended fix: Split provider-created schedules or otherwise represent the final remainder so total provider collections equal the generated schedule.
  - Parallelization: independent money-movement owner
  - Progress: skipped after re-check on 2026-06-10 by `mobilelistingspage` fixer session; current code already rejects provider-managed Rotessa drafts whose interest amount does not divide outstanding interest exactly.
<!-- /manifest:PR573-F3 -->

<!-- manifest:PR532-F1 -->
- [x] PR532-F1: Stripe checkout success/refund handling still has retry and event-classification gaps
  - Status: completed
  - Source: Review thread
  - Verdict: Completed - Fixed
  - Priority: P0
  - Current files/lines: `convex/payments/webhooks/stripe.ts:70`, `convex/checkout/reconciliation.ts:388`, `convex/checkout/reconciliation.ts:423`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/532#discussion_r3142692858, https://github.com/Connorbelez/flapptanstack/pull/532#discussion_r3142692859, https://github.com/Connorbelez/flapptanstack/pull/532#discussion_r3149084136, https://github.com/Connorbelez/flapptanstack/pull/523#discussion_r3144129897
  - Recommended fix: Do not treat `checkout.session.completed` as settled payment proof; persist retryable refund state after provider refund failures; distinguish replacement-reservation success from later relink/patch failures.
  - Parallelization: batch with PR573-F2
  - Progress: in progress on 2026-06-10 by `mobilelistingspage` fixer session; scoped to PR532-F1.
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; async Stripe checkout success, retryable recorded-refund state, and late re-lock post-reservation failure handling fixed.
<!-- /manifest:PR532-F1 -->

### PR #521, #517, #515, #511, #516: deal-closing workspaces and Documenso

Linear issue: ENG-348, ENG-347, ENG-342, ENG-338, ENG-343

<!-- manifest:PR521-F1 -->
- [x] PR521-F1: Participant workspace still has receipt, signing-token, and viewer-context gaps
  - Status: completed
  - Source: Review thread / Linear requirement
  - Verdict: Completed - Fixed
  - Priority: P0
  - Current files/lines: `convex/deals/queries.ts`, `src/components/deals/participant/ParticipantDealWorkspacePage.tsx`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/521#discussion_r3168518886, https://github.com/Connorbelez/flapptanstack/pull/521#discussion_r3168518910, https://github.com/Connorbelez/flapptanstack/pull/521#discussion_r3168518918; `specs/ENG-348/audit.md` verdict `not ready`
  - Recommended fix: Use newest archive row only for receipt evidence, pass viewer context into package surface reads, and exchange opaque signing tokens through a real sign-flow action/URL handoff.
  - Parallelization: shared deal-closing owner
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; receipt archive handling re-checked as current, participant package surfaces now receive viewer context, and opaque signing tokens launch through a server-derived signing-session action.
<!-- /manifest:PR521-F1 -->

<!-- manifest:PR515-F1 -->
- [x] PR515-F1: Documenso webhook parsing still risks missing nested provider identifiers and terminal-event ordering
  - Status: completed
  - Source: Review thread / Linear requirement
  - Verdict: Completed - Fixed
  - Priority: P1
  - Current files/lines: `convex/deals/envelopeWebhooks.ts`
  - Original review or requirement: PR #515 review threads; `specs/ENG-342/audit.md` verdict `not ready`
  - Recommended fix: Parse provider IDs from nested webhook payloads, read secret headers before verification, and avoid completion reconciliation after terminal failure events.
  - Parallelization: independent backend owner
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; nested Documenso data payload parsing fixed and terminal-event precedence re-checked against current tests.
<!-- /manifest:PR515-F1 -->

### PR #541, #542, #543, #536: route tree and MIC route comments

Linear issue: ENG-307, ENG-357, ENG-358, ENG-355

<!-- manifest:PR541-F1 -->
- [x] PR541-F1: Borrower financing draft form can still submit a native POST
  - Status: completed
  - Source: Review thread
  - Verdict: Completed - Fixed
  - Priority: P1
  - Current files/lines: `src/components/borrower/financing/BorrowerFinancingApplicationPage.tsx`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/541#discussion_r3182495413
  - Recommended fix: Remove native `method="post"` or intercept submit until a real route/server action exists.
  - Parallelization: independent frontend owner
  - Progress: in progress on 2026-06-10 by `mobilelistingspage` fixer session; scoped to remaining all-findings batch.
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; native POST method removed and form submit is prevented until a real draft action exists.
<!-- /manifest:PR541-F1 -->

<!-- manifest:PR541-F2 -->
- [ ] PR541-F2: Generated route-tree conflict comments are stale in current branch
  - Status: skipped-after-recheck
  - Source: Review thread
  - Verdict: Stale - Skip fix
  - Priority: P0
  - Current files/lines: `src/routeTree.gen.ts`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/542#discussion_r3156446099, https://github.com/Connorbelez/flapptanstack/pull/536#discussion_r3169708251, https://github.com/Connorbelez/flapptanstack/pull/541#discussion_r3182495427
  - Recommended fix: None. Current `rg -n "<<<<<<<|=======|>>>>>>>" src/routeTree.gen.ts src/routes` returns no conflict markers.
  - Parallelization: skip
  - Progress: skipped after re-check on 2026-06-10 by `mobilelistingspage` fixer session; conflict-marker search remains clean.
<!-- /manifest:PR541-F2 -->

### PR #540, #520, #518, #512: portal landing and portal security

Linear issue: ENG-306, ENG-304, ENG-305, ENG-303

<!-- manifest:PR540-F1 -->
- [x] PR540-F1: Lender CTA and entry-path validation still need portal-safe gating
  - Status: completed
  - Source: Review thread
  - Verdict: Completed - Fixed
  - Priority: P1
  - Current files/lines: `convex/portals/queries.ts`, `convex/onboarding/lenderLanding.ts`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/540#discussion_r3144414616, https://github.com/Connorbelez/flapptanstack/pull/540#discussion_r3144413917, https://github.com/Connorbelez/flapptanstack/pull/540#discussion_r3144415242
  - Recommended fix: Gate lender handoff CTA to broker-attributed portals and constrain accepted entry-path query params/origins.
  - Parallelization: batch with PR512-F1 if touching portal validators
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; non-broker lender CTAs now avoid `/start-lending`, and lender handoff entry paths reject absolute, protocol-relative, backslash, and unsupported-query inputs.
<!-- /manifest:PR540-F1 -->

<!-- manifest:PR512-F1 -->
- [x] PR512-F1: Portal landing href validator still accepts backslash external-link bypasses
  - Status: completed
  - Source: Review thread
  - Verdict: Completed - Fixed
  - Priority: P1
  - Current files/lines: `convex/portals/validators.ts:358`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/512#discussion_r3142177339
  - Recommended fix: Reject backslashes in stored portal landing hrefs before browser URL normalization can reinterpret them as path separators.
  - Parallelization: batch with PR540-F1
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; stored landing hrefs with backslashes are rejected before regex matching.
<!-- /manifest:PR512-F1 -->

### PR #513 and #509: Velocity

Linear issue: ENG-335, ENG-337

<!-- manifest:PR513-F1 -->
- [x] PR513-F1: Velocity test harness setup and failure mutation need environment hardening
  - Status: completed
  - Source: Review thread
  - Verdict: Completed - Fixed
  - Priority: P1
  - Current files/lines: `playwright.config.ts`, `convex/test/velocityE2e.ts`
  - Original review or requirement: PR #513 review threads
  - Recommended fix: Exclude Velocity auth setup from shared setup matching and gate test-only failure mutation outside non-test environments.
  - Parallelization: independent
  - Progress: in progress on 2026-06-10 by `mobilelistingspage` fixer session; scoped to remaining all-findings batch.
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; setup project matching is exact-path scoped and Velocity failure helpers require explicit non-production test enablement.
<!-- /manifest:PR513-F1 -->

<!-- manifest:PR509-F1 -->
- [ ] PR509-F1: Velocity loanCode patch route comment is stale
  - Status: skipped-after-recheck
  - Source: Review thread
  - Verdict: Stale - Skip fix
  - Priority: P1
  - Current files/lines: `convex/http.ts:89`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/509#discussion_r3139996553, https://github.com/Connorbelez/flapptanstack/pull/509#discussion_r3183375616
  - Recommended fix: None. Current code registers `pathPrefix: "/api/dev/mock-velocity/deals/"`.
  - Parallelization: skip
  - Progress: skipped after re-check on 2026-06-10 by `mobilelistingspage` fixer session; prefix route remains present.
<!-- /manifest:PR509-F1 -->

### Cross-PR artifacts and stale generated-output comments

Linear issue: not found

<!-- manifest:XPR-F1 -->
- [x] XPR-F1: `.superpowers` runtime artifact comments are partly stale but tracked artifacts remain
  - Status: completed
  - Source: Cross-PR synthesis
  - Verdict: Completed - Fixed
  - Priority: P2
  - Current files/lines: `.gitignore:32`, `.superpowers/brainstorm/18570-1777767946/state/server-info`, `.superpowers/verification/admin-lawyers/README.md`
  - Original review or requirement: https://github.com/Connorbelez/flapptanstack/pull/573#discussion_r3178372789, https://github.com/Connorbelez/flapptanstack/pull/573#discussion_r3178372790
  - Recommended fix: Remove currently tracked `.superpowers` artifacts from Git. The original `server.pid`/`server-stopped` files are gone and `.superpowers/` is now ignored.
  - Parallelization: independent
  - Progress: in progress on 2026-06-10 by `mobilelistingspage` fixer session; scoped to remaining all-findings batch.
  - Progress: completed on 2026-06-10 by `mobilelistingspage` fixer session; tracked `.superpowers` runtime artifacts removed from the index.
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

Verdict: Completed - Fixed
Reason: WorkOS membership side effects are external and stateful; this pass moved org-change detection and old-membership removal to the lender canonical org.
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
- Claimed and fixed on 2026-06-10 by `mobilelistingspage` fixer session.
- Original review context refreshed from PR #577 review comments `r3178819901`, `r3192111974`, and `r3192111976`.
- GitNexus impact: direct symbol lookups for `removeCurrentMembership`, `previewBrokerReassignment`, and `reassignBroker` were not indexed despite an up-to-date graph; fallback graph query also returned no reassignment process entries. Local blast radius was scoped with `rg` to `convex/admin/lenders/reassignment.ts`, `convex/admin/lenders/reassignmentInternal.ts`, `convex/admin/lenders/__tests__/reassignment.test.ts`, and the admin reassignment dialog test. No HIGH/CRITICAL GitNexus warning was available.
- Red coverage first: `bun run test -- convex/admin/lenders/__tests__/reassignment.test.ts` failed on new regressions proving preview used the broker row org and current-membership removal listed WorkOS memberships under `organizationId: ""` when the broker row lacked `orgId`.
- Production fix: `previewBrokerReassignment` now compares target WorkOS orgs against `lender.orgId ?? current.orgId`; `removeCurrentMembership` lists old memberships by `lender.orgId ?? currentBroker.orgId` and returns `not_found` without calling WorkOS when no canonical current org exists.
- Green validation: `bun run test -- convex/admin/lenders/__tests__/reassignment.test.ts` passed 26 tests.
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

Verdict: Completed - Fixed
Reason: The comments matched current code and affected accounting correctness; this pass implemented the shared lifecycle and accounting fixes.
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
- Claimed and fixed on 2026-06-10 by `mobilelistingspage` fixer session.
- Original review context refreshed from PR #576 review comments `r3192140743`, `r3192140760`, `r3192140761`, `r3192140766`, and `r3192140768`.
- GitNexus impact: direct `npx gitnexus impact --repo fairlendapp` lookups for `createFeeAssessment`, `getPrimaryBorrowerIdForMortgage`, `applyBorrowerFeeToMortgage`, `getFeeRevenueSummary`, and `getAdminFeeManagementSnapshot` returned target-not-found for fluent/internal exports; fallback `npx gitnexus query "fee assessment lifecycle createFeeAssessment applyBorrowerFeeToMortgage fee revenue summary primary borrower" --repo fairlendapp` scoped the blast radius to the Fees module resolver lifecycle helpers (`normalizeEffectiveFrom`, `dateInRange`, `rangesOverlap`) with no HIGH/CRITICAL risk emitted.
- Red coverage first: `bun run test -- convex/fees/__tests__/assessments.test.ts convex/fees/__tests__/config.test.ts` failed on seven expected regressions: missing audit journal rows for assessment creation/linking, inactive/out-of-window assessment acceptance, reversed income inclusion, arbitrary multi-borrower fallback, and inactive/out-of-window borrower fee application.
- Production fix: added `assertMortgageFeeAppliesOnDate`; added a registered `feeAssessment` governed machine plus `transitionFeeAssessmentToStatus`; persisted transient `draft` status with `machineContext`/`lastTransitionAt`; routed assessment create/link, borrower fee application, cash-ledger settlement, and cash-ledger reversal through governed transitions; rejected multiple borrower links without an explicit primary; excluded reversed assessments from fee revenue summaries and admin snapshot revenue.
- Green validation: `bun run test -- convex/fees/__tests__/assessments.test.ts convex/fees/__tests__/config.test.ts` passed 37 tests; `bun run test -- convex/payments/cashLedger/__tests__/reversalCascade.test.ts convex/payments/cashLedger/__tests__/integration.test.ts convex/fees` passed 74 tests; post-type-fix focused run `bun run test -- convex/fees/__tests__/assessments.test.ts convex/fees/__tests__/config.test.ts convex/payments/cashLedger/__tests__/reversalCascade.test.ts` passed 46 tests.
- Repo gates: `bun check` passed with the existing warning backlog and formatted four files; `bun typecheck` passed; `bunx convex codegen` passed after one transient Convex fetch retry.
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

Verdict: Completed - Fixed
Reason: Settlement now persists the obligation link onto each settled fee assessment, and reversal cascade now reverses every `SERVICING_FEE_RECOGNIZED` journal entry in the allocation group and marks each linked fee assessment `reversed`.
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
- 2026-06-10: Implemented on `mobilelistingspage`. `linkServicingFeeAssessmentToJournalEntry` now patches `obligationId` alongside `amountSettledCents`, `cashLedgerJournalEntryId`, status, and `updatedAt`.
- `postPaymentReversalCascade` now filters all allocation-group `SERVICING_FEE_RECOGNIZED` entries instead of using the first match, posts a distinct reversal for each original servicing-fee journal entry, and marks each linked obligation-scoped fee assessment as `reversed`.
- Added regression coverage in `convex/payments/cashLedger/__tests__/reversalCascade.test.ts` for a split servicing-fee allocation with two assessment metadata rows, including a detached assessment that must be linked during settlement and both assessments that must be reversed during cascade.
- Red verification: `bun run test -- convex/payments/cashLedger/__tests__/reversalCascade.test.ts` failed before the implementation because the detached assessment did not receive `obligationId`.
- Green verification: `bun run test -- convex/payments/cashLedger/__tests__/reversalCascade.test.ts`; `bun run test -- convex/payments/cashLedger convex/fees --exclude convex/payments/cashLedger/__tests__/regressionVerification.test.ts`; `bun check`; `bun typecheck`; `bunx convex codegen`.
- Full validation note: unexcluded `bun run test -- convex/payments/cashLedger convex/fees` failed only in `convex/payments/cashLedger/__tests__/regressionVerification.test.ts`, which compares `convex/ledger` source files against `main` and reported pre-existing stacked-branch changes to `convex/ledger/mutations.ts` and `convex/ledger/reservations.ts`; this PR576-F2 session did not modify any `convex/ledger` files.
- GitNexus: fresh impact was LOW for `postSettlementAllocation` and `postPaymentReversalCascade`; the local helper `linkServicingFeeAssessmentToJournalEntry` was not independently indexed, so it is covered by the `postSettlementAllocation` impact surface.
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

Verdict: Completed - Fixed
Reason: Admin affordances that do nothing create operational ambiguity in fee management; unsupported fee admin actions now render disabled unavailable states instead of live no-op controls.
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
- Claimed and fixed on 2026-06-10 by `mobilelistingspage` fixer session.
- Original review context refreshed from the PR #576 review threads summarized in this artifact.
- GitNexus impact: direct component lookups for `BulkApplyFeeSetPanel`, `FeeSetForm`, and `MortgageFeeApplicationPanel` were not indexed; local blast radius is the three fee admin leaf components, the shared unavailable action helper, and fee admin component tests.
- Red/diagnostic coverage: the first focused run of `bun run test -- src/components/admin/fees/__tests__/fee-admin-actions.test.tsx src/components/admin/fees/__tests__/fee-value.test.tsx` failed before harness adjustment because the new RTL test needed explicit jsdom; after jsdom and local `ResizeObserver` setup, the tests assert all three former dead actions are disabled and expose explicit unavailable titles.
- Production fix: added `UnavailableActionButton` and changed `Preview`, `Save set`, and `Inspect` to disabled button affordances with action-specific unavailable labels rather than frontend-only fake behavior.
- Green validation: `bun run test -- src/components/admin/fees/__tests__/fee-admin-actions.test.tsx src/components/admin/fees/__tests__/fee-value.test.tsx` passed 5 tests.
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

Verdict: Completed - Fixed
Reason: Admin lawyer onboarding wrote identity and verification state with partial identity evidence; this pass fixed the remaining identity, delivery, and auditability gaps.
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
- Claimed and fixed on 2026-06-10 by `mobilelistingspage` fixer session.
- Original review context refreshed from PR #574 review comments `r3178427831`, `r3192122180`, `r3192122185`, and `r3192122190`.
- GitNexus impact: `resolveWorkosInvitationToken`, `acceptGuestInvitationByWorkosInvitationInternal`, and `deliverGuestInvitation` reported LOW risk with no upstream callers/processes; `acceptWorkosInvitationForOnboardingInternal` was not indexed, so edits were scoped through the same `convex/legalRepresentation/invitations.ts` batch and validated by legal-representation tests.
- Red coverage first: `bun run test -- convex/legalRepresentation/__tests__/adminLawyers.test.ts` failed on the new regressions for >100-row case-insensitive WorkOS user lookup, mismatched caller authId acceptance, platform invitation delivery reservation, and non-SHA evidence hashes.
- Production fix: `findSyncedUserByEmail` now scans all local synced users after indexed exact lookup; non-`create_pending` platform invites reject caller auth IDs that do not match the resolved WorkOS user or existing profile; platform invitation delivery now reserves `deliveryStatus: "sending"` before external WorkOS send and skips duplicates; admin representation verification stores `sha256:<hex>` over deterministic submitted evidence content.
- Green validation: `bun run test -- convex/legalRepresentation/__tests__/adminLawyers.test.ts` passed 13 tests; `bun run test -- convex/legalRepresentation` passed 105 tests.
- Repo gates: `bun check` passed with the existing warning backlog and formatted five files; `bunx convex codegen` passed after one transient Convex fetch retry; `bun typecheck` passed.
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

Verdict: Completed - Fixed
Reason: Admin actions must target the intended deal/profile, not a local heuristic; detail actions now consume explicit server-projected action target IDs.
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
- Claimed and fixed on 2026-06-10 by `mobilelistingspage` fixer session.
- Original review context refreshed from the PR #574 review threads summarized in this artifact.
- GitNexus impact: direct symbol lookups for `AdminLawyersDetailSheet`, `InvitePlatformLawyerDialog`, and `getLawyerAdminDetail` were not indexed; local blast radius is `convex/legalRepresentation/adminLawyers.ts`, `src/components/admin/lawyers/admin-lawyers-model.ts`, `AdminLawyersDetailSheet.tsx`, `InvitePlatformLawyerDialog.tsx`, and admin-lawyer tests.
- Red coverage first: `bun run test -- convex/legalRepresentation/__tests__/adminLawyers.test.ts src/test/admin/admin-lawyers-page.test.tsx` failed because `detail.actionTargets` was missing, the sheet submitted verification for `deal_1` instead of the server-projected `deal_2`, and the invite dialog closed before the deferred mutation resolved.
- Production fix: `getLawyerAdminDetail` now projects `actionTargets.representationDealId` and `replacementDealId`; the detail sheet uses those IDs for verification/override/replacement and resets local state on profile changes; the platform invite dialog awaits mutation completion before reset/close and keeps errors visible on failure.
- Green validation: `bun run test -- convex/legalRepresentation/__tests__/adminLawyers.test.ts src/test/admin/admin-lawyers-page.test.tsx` passed 24 tests.
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

Verdict: Completed - Fixed
Reason: Some status-guard work had landed in one accept path, but read-only lookup and parity issues remained; this pass fixed those current-code gaps.
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
- Claimed and fixed on 2026-06-10 by `mobilelistingspage` fixer session.
- Original review context refreshed from PR #575 comments `r3192119083`, `r3192119077`, and PR #573 comment `r3178355686`.
- GitNexus impact: `resolveWorkosInvitationToken` LOW risk, `acceptGuestInvitationByWorkosInvitationInternal` LOW risk, no upstream callers/processes; `acceptWorkosInvitationForOnboardingInternal` was not indexed and was handled as a same-file internal endpoint.
- Red coverage first: `bun run test -- convex/legalRepresentation/__tests__/invitations.test.ts` failed on read-only WorkOS token resolution and terminal revoked WorkOS invitation handling.
- Production fix: `resolveWorkosInvitationToken` no longer calls onboarding start/resume mutations or returns session route IDs; WorkOS invitation lookup no longer filters out terminal guest invitation statuses; `acceptWorkosInvitationForOnboardingInternal` shares the verified/revoked terminal result guard with `acceptGuestInvitationByWorkosInvitationInternal`.
- Green validation: `bun run test -- convex/legalRepresentation/__tests__/invitations.test.ts` passed 14 tests; `bun run test -- convex/legalRepresentation` passed 105 tests.
- Repo gates: covered by the shared PR574-F1/PR575-F1 batch gates: `bun check`, `bunx convex codegen`, and `bun typecheck` all passed.
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

Verdict: Completed - Fixed
Reason: The local wrapper is no longer too late; the exported route component renders `Authenticated`/`AuthLoading`, and the suspense query lives in a child content component rendered only by `Authenticated`.
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
- Claimed and fixed on 2026-06-10 by `mobilelistingspage` fixer session.
- Original review context refreshed from PR #575 comment `r3178778248`.
- GitNexus impact: `LawyerOnboardingRouteComponent` and `lawyerOnboardingQueryOptions` were not indexed; fallback GitNexus query found the lawyer route/layout auth flow and no high/critical blast radius.
- Red coverage first: `bun run test -- src/test/routes/deal-portal-route.test.tsx src/test/lawyer/lawyerOnboardingRoute.test.tsx` failed because the loader still prefetched before auth readiness and `useSuspenseQuery` still fired when `Authenticated` withheld children.
- Production fix: `src/routes/lawyer/onboarding.$sessionId.tsx` now has a param-only loader and an exported auth-gate component; `useSuspenseQuery` moved into `LawyerOnboardingRouteContent`, rendered under `Authenticated`.
- Green validation: `bun run test -- src/test/routes/deal-portal-route.test.tsx src/test/lawyer/lawyerOnboardingRoute.test.tsx` passed 9 tests.
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

Verdict: Completed - Fixed
Reason: The deal portal route now gates the suspense query behind `Authenticated`, and the loader no longer starts Convex query work before the auth readiness boundary.
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
- Claimed and fixed on 2026-06-10 by `mobilelistingspage` fixer session.
- Original review context refreshed from PR #573 comment `r3178355683`.
- GitNexus impact: `DealPortalRouteComponent` LOW risk with no upstream callers/processes; `dealPortalQueryOptions` LOW risk with one same-file caller. Fallback query also found no high/critical route-auth blast radius.
- Red coverage first: `bun run test -- src/test/routes/deal-portal-route.test.tsx src/test/lawyer/lawyerOnboardingRoute.test.tsx` failed because the loader still prefetched before auth readiness and `useSuspenseQuery` still fired when `Authenticated` withheld children.
- Production fix: `src/routes/deals/$dealId.tsx` now has a param-only loader and an exported auth-gate component; `useSuspenseQuery` moved into `DealPortalRouteContent`, rendered under `Authenticated`.
- Green validation: `bun run test -- src/test/routes/deal-portal-route.test.tsx src/test/lawyer/lawyerOnboardingRoute.test.tsx` passed 9 tests.
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

Original-code evidence:
- Original location: `convex/dealLocks/mutations.ts:92`, `convex/dealLocks/mutations.ts:382`, `convex/dealLocks/mutations.ts:563`
- GitNexus: checkout/deal-lock query found `convex/dealLocks/mutations.ts`; no HIGH/CRITICAL callgraph risk emitted.
- Local evidence: code set `sellerAuthId: seller.lenderId`; `ensureListingVisibleForCheckout` returned when `portalId` was absent.

Verdict: Completed - Fixed
Reason: The current code now fails closed without portal context, persists seller auth identity from the sale lot, and replays Stripe success after partial deal insertion without creating a duplicate deal.
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
- 2026-06-10: Implemented on `mobilelistingspage`. `prepareCheckoutSession` now requires `portalId`, `ensureListingVisibleForCheckout` fails closed without portal context, and checkout sessions persist `seller.lot.sellerAuthId` while ledger reservation still uses `seller.lenderId`.
- Added `findExistingCheckoutDeal` and `finalizePaidCheckoutDeal` recovery in `processStripeCheckoutSuccess`; Stripe success retries after deal insert but before session patch now reuse the existing deal, replay idempotent access grants, complete the transition when the deal is still `initiated`, patch reservation/session state, and return `duplicate_success`.
- Added regression coverage in `convex/dealLocks/__tests__/checkout.test.ts` for missing portal context before reservation/session creation and partial Stripe success retry reuse/finalization.
- Red verification: `bun run test -- convex/dealLocks/__tests__/checkout.test.ts` failed before the implementation on the missing-portal and partial-retry assertions.
- Green verification: `bun run test -- convex/dealLocks/__tests__/checkout.test.ts`; `bun run test -- convex/dealLocks convex/checkout`; `bun check`; `bun typecheck`; `bunx convex codegen`.
- GitNexus: refreshed stale index with `npx gitnexus analyze`; fresh impact was LOW for `ensureListingVisibleForCheckout`, `prepareCheckoutSession`, and `processStripeCheckoutSuccess`. `gitnexus detect-changes` was not available in this session because the local CLI has no `detect-changes` subcommand and no GitNexus MCP tool namespace was exposed, so final scope was checked with fresh symbol impact plus `git diff`.
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

Verdict: Stale - Skip fix
Reason: Current code rejects provider-managed Rotessa drafts before activation when outstanding interest is not evenly divisible by the selected interest payment amount, so the provider-created constant-amount schedule cannot over-collect a final remainder.
Recommended update: None; current architecture chose the review's safe rejection option instead of splitting the remainder off-provider.
Additional comments: This is a money movement P0.
Recommended fix: If Rotessa cannot express variable final installment, create separate provider schedules or keep provider-managed activation disabled for remainder schedules.
Implementation guidance: Add test where total interest does not divide evenly by installment count.
Suggested owner: shared refactor owner
Shared abstraction/refactor opportunity: Provider schedule generation strategy.
Footguns and guardrails:
- Do not round final remainder into every installment.
Validation: `bun run test -- convex/payments/scheduleReplacement`

Implementation notes:
- 2026-06-10 re-check on `mobilelistingspage`: no production code change required. `buildReplacementPreview` returns `provider_uniform_interest_amount_required` for provider-managed Rotessa when `outstandingInterestAmount % interestPaymentAmount !== 0`; `createOrUpdateScheduleReplacementDraft` stores the draft as `draft` with that issue, so `applyProviderManagedReplacementInternal` cannot reach `provider.createSchedule` for a remainder schedule.
- Existing regression coverage: `convex/payments/scheduleReplacement/__tests__/scheduleMath.test.ts` covers the preview rejection, and `convex/payments/scheduleReplacement/__tests__/drafts.test.ts` covers the persisted draft validation issue.
- Validation: `bun run test -- convex/payments/scheduleReplacement` passed with 37 tests.
- GitNexus: fresh impact was LOW for `applyProviderManagedReplacementInternal`, `prepareProviderManagedReplacementInternal`, and `buildReplacementPreview`.
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

Verdict: Completed - Fixed
Reason: Stripe async paid checkout events now enter the checkout success path; completed-but-unpaid Checkout sessions still fail closed; late-success refunds in `intent_recorded` or `failed` state now return `refund_required` with the stored idempotency key instead of being marked processed; and late re-lock only swallows reservation failures, not post-reservation session relink/patch failures.
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
- 2026-06-10: Implemented on `mobilelistingspage`. Added `checkout.session.async_payment_succeeded` to `CHECKOUT_SUCCESS_EVENT_TYPES` while preserving the existing `payment_status === "paid"` guard for completed sessions.
- Changed `reconcileLateSuccess` so any existing non-`completed` `lateSuccessRefund` returns `refund_required` with the stored refund amount, payment intent, provider event, and idempotency key; the replay webhook remains pending until the refund actually completes.
- Split `relockExpiredCheckoutReservation` so only `reserveSharesHandler` insufficiency/failure returns `null` for the refund path. After a replacement reservation exists, missing-reservation or checkout-session patch/read failures now throw and leave the webhook retryable instead of incorrectly recording a refund path.
- Added regression coverage in `convex/payments/webhooks/__tests__/stripeWebhook.test.ts` for async paid Checkout webhook classification and HTTP reconciliation, and updated `convex/checkout/__tests__/start.test.ts` to assert recorded-but-incomplete late-success refund replay remains retryable.
- Red verification: `bun run test -- convex/payments/webhooks/__tests__/stripeWebhook.test.ts convex/checkout/__tests__/start.test.ts` failed before the implementation because async Checkout events were ignored and `intent_recorded` refund replays returned `refund_already_recorded`.
- Green verification: `bun run test -- convex/payments/webhooks/__tests__/stripeWebhook.test.ts convex/checkout/__tests__/start.test.ts`; `bun run test -- convex/checkout convex/payments/webhooks`; `bun check`; `bun typecheck`; `bunx convex codegen`.
- GitNexus: fresh impact was LOW for `processCheckoutSuccessWebhook`, `reconcileLateSuccess`, and `relockExpiredCheckoutReservation`.
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

Verdict: Completed - Fixed
Reason: Current code already excluded failed/blocked signed archives from participant receipt evidence; the remaining viewer-context and opaque-signing-token gaps are now fixed.
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
- Claimed and fixed on 2026-06-10 by `mobilelistingspage` fixer session.
- Original review context refreshed from PR #521 comments `r3168518886`, `r3168518910`, `r3168518918`, plus `specs/ENG-348/audit.md`.
- GitNexus impact: `buildParticipantDealWorkspace` LOW risk with one same-file direct caller and no affected execution processes; `readParticipantSigningTask` LOW risk with the participant workspace process affected; `ParticipantDealWorkspacePage` LOW risk with no upstream callers.
- Re-check: receipt evidence handling already used the newest sorted archive rows and existing tests covered failed/blocked archive rows not completing participant receipts.
- Red coverage first: `bun run test -- convex/deals/__tests__/participantWorkspace.test.ts src/test/deals/participant-workspace.test.tsx` failed because package surfaces lacked viewer context and the UI did not launch opaque signing tokens through a server action.
- Production fix: `buildParticipantDealWorkspace` now passes the current viewer into `readDealDocumentPackageSurface`; new `convex/deals/signingSessions.ts` derives the authenticated recipient server-side and asks Documenso for an embedded signing session; `ParticipantDealWorkspacePage` calls that action and opens the returned provider-safe URL instead of linking raw tokens.
- Green validation: `bun run test -- convex/deals/__tests__/participantWorkspace.test.ts src/test/deals/participant-workspace.test.tsx` passed 12 tests; shared deal-closing batch validation passed 23 tests.
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

Verdict: Completed - Fixed
Reason: Nested Documenso payload identifiers are now normalized, secret verification already occurs before parsing/processing, and current terminal-event handling returns before completion reconciliation.
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
- Claimed and fixed on 2026-06-10 by `mobilelistingspage` fixer session.
- Original review context refreshed from PR #515 review summary and `specs/ENG-342/audit.md`.
- GitNexus impact: `parseDocumensoWebhookEvent` LOW risk with same-file/HTTP import blast radius; `processDocumensoProviderEvent` LOW risk with no upstream callers.
- Re-check: current `documensoWebhook` already reads and verifies the secret header before parsing; `processDocumensoProviderEvent` already avoids completion reconciliation after terminal attempt status and terminal provider events.
- Red coverage first: `bun run test -- convex/deals/__tests__/envelopes.test.ts` failed because nested `data.document`, `data.envelope`, `data.recipient`, and `data.eventId` identifiers were dropped.
- Production fix: `parseDocumensoWebhookEvent` now normalizes provider IDs from root, `payload`, `data`, and `payload.data` shapes, including nested `document`/`envelope`/`recipient` objects while preserving legacy `payload.id` document IDs.
- Green validation: `bun run test -- convex/deals/__tests__/envelopes.test.ts` passed 11 tests; shared deal-closing batch validation passed 23 tests.
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

Verdict: Completed - Fixed
Reason: Native form submission is a user-visible workflow break; the borrower financing continuation form no longer exposes a native POST route.
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
- Claimed and fixed on 2026-06-10 by `mobilelistingspage` fixer session.
- Original review context refreshed from PR #541 comment `r3182495413`.
- GitNexus impact: `BorrowerFinancingApplicationPage` returned LOW risk with no upstream processes/modules.
- Red coverage first: `bun run test -- src/test/routes/borrower-financing-application.test.tsx` failed because the form still had `method="post"`.
- Production fix: removed the native form method and added an explicit `onSubmit` `preventDefault` handler until a real draft persistence action exists.
- Green validation: `bun run test -- src/test/routes/borrower-financing-application.test.tsx` passed 3 tests.
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
- Skipped after re-check on 2026-06-10 by `mobilelistingspage` fixer session.
- Current-code evidence remains clean: `rg -n "<<<<<<<|=======|>>>>>>>" src/routeTree.gen.ts src/routes` has no conflict markers, so the generated route-tree review comment is stale.
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

Verdict: Completed - Fixed
Reason: Broker-attributed portals keep canonical lender handoff CTAs; non-broker portals no longer expose `/start-lending`, and handoff mutation input is constrained to relative allowed portal paths/query keys.
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
- Claimed and fixed on 2026-06-10 by `mobilelistingspage` fixer session.
- Original review context refreshed from PR #540 comments `r3144414616`, `r3144413917`, `r3144415242`.
- GitNexus impact: `lenderHandoffAction` LOW risk with direct callers in `buildSwitchboard`, `toLandingListingItem`, and `buildFeaturedListings`; `buildSwitchboard` LOW risk; `buildFeaturedListings` LOW risk; `normalizeEntryPath` LOW risk with one same-file direct caller.
- Red coverage first: `bun run test -- convex/portals/__tests__/landing.test.ts convex/onboarding/__tests__/lenderLanding.test.ts` failed because FairLend app portal lender CTA still pointed at `/start-lending`, absolute `entryPath` was accepted, and stored backslash hrefs were accepted.
- Production fix: `convex/portals/queries.ts` gates `/start-lending` actions to broker-attributed portals and falls back to `/listings` otherwise; `convex/onboarding/lenderLanding.ts` rejects absolute/protocol-relative/backslash entry paths and unknown query params.
- Green validation: `bun run test -- convex/onboarding/__tests__/lenderLanding.test.ts` passed 6 tests; `bun run test -- convex/portals/__tests__/landing.test.ts convex/onboarding/__tests__/lenderLanding.test.ts` passed 23 tests after also refreshing the stale convex-test module map for `portals/landingMutations`.
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

Verdict: Completed - Fixed
Reason: Stored portal landing href validation now rejects backslashes before regex matching, closing the browser-normalization bypass.
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
- Claimed and fixed on 2026-06-10 by `mobilelistingspage` fixer session.
- Original review context refreshed from PR #512 comment `r3142177339`.
- GitNexus impact: `assertSafePortalLandingHref` LOW risk with direct path through landing action/content validation in the Portals module.
- Red coverage first: `bun run test -- convex/portals/__tests__/landing.test.ts convex/onboarding/__tests__/lenderLanding.test.ts` failed because `/\\evil.example/path` was accepted as a stored landing action href.
- Production fix: `assertSafePortalLandingHref` rejects any `\` before applying the existing safe local/hash href regex.
- Green validation: `bun run test -- convex/portals/__tests__/landing.test.ts convex/onboarding/__tests__/lenderLanding.test.ts` passed 23 tests.
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

Verdict: Completed - Fixed
Reason: Test-only public mutations and broad auth setup matching can affect unrelated E2E runs; the setup matcher and helper guard are now fail-closed.
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
- Claimed and fixed on 2026-06-10 by `mobilelistingspage` fixer session.
- Original review context refreshed from the PR #513 review threads summarized in this artifact.
- GitNexus impact: `patchVelocityMockDealHttp` LOW risk; `recordFailedActivationAttempt` lookup resolved to the E2E helper method and returned LOW risk with no upstream processes.
- Red coverage first: `bun run test -- src/test/velocity-e2e-hardening.test.ts` failed because the shared setup project used broad string `auth.setup.ts` matching and the Velocity runtime guard helper did not exist.
- Production fix: scoped the shared Playwright setup project to exact root `e2e/auth.setup.ts`; added `isVelocityE2eRuntimeAllowed` and made `recordFailedActivationAttempt` require `VELOCITY_E2E_ENABLED=true`, `ALLOW_TEST_AUTH_ENDPOINTS=true`, and non-production `NODE_ENV`.
- Green validation: `bun run test -- src/test/velocity-e2e-hardening.test.ts` passed 2 tests; `bun run test:e2e -- --list` passed and listed `velocity/auth.setup.ts` only under `[velocity-setup]`, while `[setup]` listed only root `auth.setup.ts`.
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
- Skipped after re-check on 2026-06-10 by `mobilelistingspage` fixer session.
- Current-code evidence remains satisfied: `convex/http.ts` registers `pathPrefix: "/api/dev/mock-velocity/deals/"`; no code change is required for this stale review comment.
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

Verdict: Completed - Fixed
Reason: Original exact files were stale, but the tracked-artifact class was still real; the remaining tracked `.superpowers` runtime files have been removed from the index.
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
- Claimed and fixed on 2026-06-10 by `mobilelistingspage` fixer session.
- Re-check evidence: `git ls-files .superpowers` initially returned `.superpowers/brainstorm/18570-1777767946/state/server-info` and `.superpowers/verification/admin-lawyers/README.md`; contents were runtime server state and local browser-verification notes, not project documentation.
- Production fix: deleted the two runtime artifacts and removed them from the Git index with `git rm --cached`; `.gitignore` already ignores `.superpowers/`.
- Validation: `git ls-files .superpowers` returned no output after the index removal.
<!-- /finding:XPR-F1 -->

## Shared Refactors And Guardrails

- Authenticated suspense routes: PR575-F2 and PR573-F1 are completed; both routes now render `Authenticated`/`AuthLoading` before any child component calls `useSuspenseQuery`, and their loaders are param-only.
- Deal-closing workspace/webhooks: PR521-F1 and PR515-F1 are completed; participant package surfaces are viewer-scoped, opaque signing tokens launch through a backend-issued signing session, and Documenso nested payload identifiers are parsed.
- Money movement: PR573-F2 and PR532-F1 are fixed; PR573-F3 was stale after re-check because current provider-managed Rotessa draft validation rejects non-even interest remainders.
- Fee accounting: PR576-F1 and PR576-F2 are completed; fee validity, assessment lifecycle, settlement linkage, and reversal semantics now share governed transition/accounting policy surfaces.
- Legal representation: PR574-F1 and PR575-F1 are completed; WorkOS identity, invitation claim/send, token lookup, and status guards now share fail-closed handling.
- Portal security: PR540-F1 and PR512-F1 are completed; CTA attribution is broker-gated, entryPath state is allowlisted, and stored landing hrefs reject browser-normalized backslash bypasses.

## Fix Queue

1. Complete: all actionable grouped findings are completed; stale findings PR573-F3, PR541-F2, and PR509-F1 are skipped after re-check.

## Final Validation

- Focused final-batch regression: `bun run test -- convex/admin/lenders/__tests__/reassignment.test.ts src/components/admin/fees/__tests__/fee-admin-actions.test.tsx src/components/admin/fees/__tests__/fee-value.test.tsx convex/legalRepresentation/__tests__/adminLawyers.test.ts src/test/admin/admin-lawyers-page.test.tsx src/test/routes/borrower-financing-application.test.tsx src/test/velocity-e2e-hardening.test.ts` passed 60 tests across 7 files.
- Playwright setup validation: `bun run test:e2e -- --list` passed and listed root `auth.setup.ts` under `[setup]` while `velocity/auth.setup.ts` remained under `[velocity-setup]`.
- Repository gates: `bun check` passed with the existing warning backlog; `bun typecheck` passed; `bunx convex codegen` passed.
- Hygiene validation: `git ls-files .superpowers` returned no output after removing the tracked runtime artifacts from the index.
- GitNexus change detection: the repository instruction names `gitnexus_detect_changes()`, but the installed CLI exposes no equivalent `detect-changes` command (`npx gitnexus help` lists analyze/status/query/context/impact/cypher/etc.). Fallback scope check used `git diff --name-status` and `git diff --cached --name-status`; the staged diff is limited to the two `.superpowers` artifact removals.
