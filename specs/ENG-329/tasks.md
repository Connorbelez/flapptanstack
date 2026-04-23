# Tasks: ENG-329 - Lender portfolio: ship actions-required rail and broker chat surface

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize the ENG-329 implementation task list, chunk plan, and execution artifacts for the rail/chat leaf slice
- [x] T-002: Run `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-329 --repo-root "/Users/connor/.codex/worktrees/6886/fairlendapp" --stage ready-to-edit` and record the pre-edit GitNexus blast radius

## Phase 2: Actions Required Rail
- [x] T-010: Add `src/components/lender/portfolio/action-item-host.tsx` to render generic renewal, payment-exception, and deal-action rows with contract-backed priority, status, due-date, and CTA states
- [x] T-011: Add `src/components/lender/portfolio/actions-rail.tsx` so the `Actions Required` surface keeps the all-clear state visible, renders the upstream action list generically, and exposes detail/prefill callbacks without owning business rules

## Phase 3: Broker Chat And Wiring
- [x] T-020: Add `src/components/lender/portfolio/broker-chat-panel.tsx` for assigned-broker, unavailable-chat, and missing-broker states using only the explicit broker-coordination contract from `ENG-308`
- [x] T-021: Replace the sticky-rail placeholder content in `src/components/lender/portfolio/LenderPortfolioPage.tsx` with the real rail/chat components and wire route-search-owned prefill selection so rail items can hand context into broker coordination while keeping `Actions Required` above broker chat

## Phase 4: Tests And Stories
- [x] T-030: Add focused rail/chat coverage in `src/test/lender/portfolio-rail.test.tsx` for surface order, all-clear rendering, unavailable-chat and missing-broker fallbacks, action-to-chat prefill behavior, and supported action-detail deep links
- [x] T-031: Update `src/components/lender/portfolio/LenderPortfolioPage.stories.tsx` with the key rail/chat states used by ENG-329
- [x] T-032: Decide whether dedicated Playwright coverage is practical for the rail/chat slice and record the result in the execution artifacts
  Decision: No dedicated Playwright spec was added because the current `e2e/` suite has no deterministic `/lender/portfolio` harness; ENG-329 is covered by focused Vitest route and component tests instead.

## Phase 5: Validation
- [x] T-900: Run `bunx convex codegen`
- [x] T-901: Run `bun check`
  Result: Passed after replacing the blocking broker-chat optional-chain pattern and nested conditional rendering.
- [x] T-902: Run `bun typecheck`
- [x] T-903: Run focused tests: `bun run test -- src/test/lender/portfolio-rail.test.tsx src/test/routes/lender-portfolio-route.test.tsx`

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against the current branch diff for ENG-329
- [x] T-920: Resolve audit findings or record blockers, then rerun the audit if needed
  Result: No product-contract gaps were found in the rail/chat implementation, and the blocking `bun check` finding is resolved.
- [x] T-930: Run final execution-artifact validation plus `gitnexus_detect_changes` and confirm the changed scope matches ENG-329
  Result: final execution-artifact validation passed after the audit finding was addressed; GitNexus changed-scope output remains stale in this worktree, so raw `git diff --name-only` is the source of truth for the live ENG-329 file scope.
