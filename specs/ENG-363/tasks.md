# Tasks: ENG-363 - Legal representation: enforce verification and engagement gates

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Gather Linear issue, comments, Notion plan, supporting docs, and repository instructions.
- [x] T-002: Scaffold execution artifacts and chunk plan.
- [x] T-003: Run ready-to-edit artifact validation.
- [x] T-004: Run GitNexus impact for existing symbols expected to change.

## Phase 2: Gate Contracts
- [x] T-010: Create `convex/legalRepresentation/engagements.ts` read/write helpers for signed engagement evidence and `manual_admin` provider boundary.
- [x] T-020: Create `convex/legalRepresentation/gates.ts` deal-level gate helper that resolves selected lawyer, access, verification, engagement, and reason codes.
- [x] T-030: Add focused tests for gate helper missing selected lawyer, wrong lawyer, missing/revoked access, stale/ineligible verification, missing engagement, and signed engagement success.

## Phase 3: Backend Enforcement
- [x] T-110: Enforce `LAWYER_VERIFIED` verification gate at the deal transition command path so admin/manual paths cannot bypass evidence.
- [x] T-120: Enforce `REPRESENTATION_CONFIRMED` in `confirmRepresentation` with active authorized lawyer plus signed engagement evidence.
- [x] T-130: Preserve `LAWYER_APPROVED_DOCUMENTS` package readiness blockers and add regression coverage if touched.
- [x] T-140: Ensure rejected gate failures surface non-sensitive reason codes through existing Convex errors/transition audit surfaces.

## Phase 4: Lawyer Workspace
- [x] T-210: Return representation gate status from `getLawyerDealWorkspace`.
- [x] T-220: Update `lawyerDealViewModel` action states to use evidence-specific blocked/allowed reasons.
- [x] T-230: Update `LawyerDealWorkspacePage` to pass gate state into actions and surface blocked reasons without relying on client-only authorization.
- [x] T-240: Update lawyer workspace view-model/component tests.

## Phase 5: Validation And Audit
- [x] T-900: Run targeted legalRepresentation, lawyer workspace, and transition tests.
- [x] T-910: Run `bunx convex codegen`.
- [x] T-920: Run `bun check`.
- [x] T-930: Run `bun typecheck`.
- [x] T-940: Run `bun run test` if transition behavior/admin path changed.
  - Full suite executed on 2026-04-30 and failed on existing unrelated baseline areas: portal landing mutation module, MIC React hook/render tests, route component/helper export tests, checkout/listing/portfolio/document/payment/velocity/admin origination tests. ENG-363 targeted suites passed after the final guest-lawyer test update.
- [x] T-950: Run `$linear-pr-spec-audit` and persist verdict to `audit.md`.
- [x] T-960: Resolve audit findings or record blockers.
- [x] T-970: Run final artifact validation and GitNexus detect changes.
  - GitNexus CLI has no `detect-changes` command in this environment; fallback evidence is `npx gitnexus status` plus `git diff --name-only`.
