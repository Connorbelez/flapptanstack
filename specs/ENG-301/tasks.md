# Tasks: ENG-301 - Broker portal: ship portal listing queries and thin route consumers

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Backend Portal Contracts
- [x] T-001: Extract or add shared listing read helpers so explicit portal query contracts can reuse the existing pricing-aware listing logic without duplicating projection math.
- [x] T-002: Add `convex/listings/portalQueries.ts` public teaser query contract on `portalPublicQuery`.
- [x] T-003: Add authenticated lender portal listings query contract on `portalLenderQuery` and clamp requested filters against `lenderFilterConstraints`.
- [x] T-004: Add a portal-aware lender listing detail contract that enforces same-portal access and keeps detail pricing aligned with list pricing.
- [x] T-005: Add or update backend tests for public teaser reads, lender reads, pricing projection, filter clamping, and wrong-portal rejection.

## Phase 2: Public Portal Host Consumer
- [x] T-010: Add portal listing query options and thin teaser UI adapters using production-safe listing components only.
- [x] T-011: Replace the root portal-host debug surface in `src/routes/index.tsx` with the public teaser consumer while preserving marketing and admin host behavior.

## Phase 3: Authenticated Lender Route Consumer
- [x] T-020: Add portal-aware query options and search plumbing for `/lender/listings`.
- [x] T-021: Implement the `/lender/listings` index route and authenticated list surface using the explicit portal lender query contract.
- [x] T-022: Refactor the lender detail route and `LenderListingDetailPage` onto the explicit portal detail contract and TanStack Query path so portal cache scoping applies to detail reads.
- [x] T-023: Add or update frontend route and component tests for portal teaser, lender list, lender detail, and host-scoped query usage.

## Phase 4: Validation
- [x] T-030: Run `bunx convex codegen`
- [x] T-031: Run `bun check`
- [x] T-032: Run `bun typecheck`
- [x] T-033: Run targeted portal and listing tests for touched backend and frontend scope
- [x] T-034: Run `bun run test:e2e` if the updated portal listing route surface is runnable in this worktree
  Explicitly not run: this checkout does not contain a focused portal-listings Playwright flow, and the existing multi-host auth/browser suite is broader than ENG-301. Manual portal-host validation remains the honest remaining proof point.
- [x] T-035: Run GitNexus final scope detection and reconcile the change set against the execution checklist
  `gitnexus_detect_changes` is not exposed through the local CLI, and `gitnexus analyze --embeddings` did not finish in a practical time window. Final scope was reconciled via `git status --short` plus `git diff --stat eng-300`, including untracked ENG-301 files.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit`
- [x] T-920: Resolve audit findings or record blockers
  Audit verdict is `needs manual validation`; no blocking `MISSING` or `CONTRADICTED` code findings remain in the local ENG-301 scope.
