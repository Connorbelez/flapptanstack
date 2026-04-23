# Spec Audit: ENG-329 - Lender portfolio: ship actions-required rail and broker chat surface

- Audit skill: `$linear-pr-spec-audit`
- Review target: current worktree diff for `ENG-329` in `/Users/connor/.codex/worktrees/6886/fairlendapp`
- Last run: 2026-04-23T14:30:09Z
- Verdict: ready

## Findings
- none

## Coverage Summary
- SATISFIED: 9
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | layout | Sticky rail keeps `Actions Required` above broker chat in the existing right-rail host | `src/components/lender/portfolio/LenderPortfolioPage.tsx`, `src/components/lender/portfolio/actions-rail.tsx`, `src/components/lender/portfolio/broker-chat-panel.tsx` | The sticky host now renders the rail/chat stack in the approved order. |
| SATISFIED | contract | Broker chat consumes the explicit broker-coordination snapshot instead of inventing local broker/chat state | `src/components/lender/portfolio/broker-chat-panel.tsx` | The panel reads assigned broker, availability, thread badge, fallback CTA, and prefill payloads directly from the snapshot contract. |
| SATISFIED | capability | Generic action items cover renewal, payment, and deal-action rows without re-owning renewal rules | `src/components/lender/portfolio/action-item-host.tsx`, `src/components/lender/portfolio/actions-rail.tsx` | Action rendering is generic and contract-backed. |
| SATISFIED | UX boundary | Broker coordination stays assigned-contact/thread oriented, not inbox-shaped | `src/components/lender/portfolio/broker-chat-panel.tsx` | The panel explicitly keeps day-one transport contract-backed and non-destructive. |
| SATISFIED | integration | Rail items deep-link or prefill broker coordination when possible | `src/components/lender/portfolio/LenderPortfolioPage.tsx`, `src/components/lender/portfolio/search.ts`, `src/components/lender/portfolio/portfolio-types.ts` | Payment/mortgage actions deep-link to detail sheets; all actions can prefill broker handoff context. |
| SATISFIED | fallback state | All-clear, unavailable-chat, and missing-broker states remain visible instead of removing the rail | `src/components/lender/portfolio/actions-rail.tsx`, `src/components/lender/portfolio/broker-chat-panel.tsx`, `src/test/lender/portfolio-rail.test.tsx` | The surface stays present across all required fallback states. |
| SATISFIED | ownership boundary | Route-shell ownership and baseline route seam stay with ENG-311 | `src/components/lender/portfolio/LenderPortfolioPage.tsx`, `src/test/routes/lender-portfolio-route.test.tsx` | The implementation stays inside the existing page/slot seam and leaves the baseline route test intact. |
| SATISFIED | tests | Focused rail/chat coverage exists for ordering, prefill behavior, fallback states, and supported deep links | `src/test/lender/portfolio-rail.test.tsx`, `src/components/lender/portfolio/LenderPortfolioPage.stories.tsx` | Storybook states and deterministic Vitest coverage were added. |
| SATISFIED | validation | Repo validation commands pass | `bun check`, `bun typecheck`, `bunx convex codegen`, `bun run test -- src/test/lender/portfolio-rail.test.tsx src/test/routes/lender-portfolio-route.test.tsx` | The previous blocking `bun check` error was fixed in `broker-chat-panel.tsx`; the remaining complexity diagnostics are non-blocking warnings. |

## Unresolved items
- none

## Next action
- none
