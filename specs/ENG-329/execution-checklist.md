# Execution Checklist: ENG-329 - Lender portfolio: ship actions-required rail and broker chat surface

## Requirements From Linear
- [x] Render a sticky right rail on desktop with `Actions Required` above broker chat.
- [x] Consume the explicit broker-coordination contract from `ENG-308` instead of inventing broker identity, availability, or prefill context in React.
- [x] Host renewal prompts, payment issues, and deal-action items in the rail without owning the renewal-specific item content or rules.
- [x] Keep broker chat day-one single-thread or assigned-contact oriented, not inbox-shaped.
- [x] Let rail items deep-link or prefill broker coordination with relevant property, payment, or deal context when possible.
- [x] Preserve all-clear, unavailable-chat, and missing-broker fallback states instead of removing the rail.
- [x] Leave route-shell ownership, shared query seams, and the baseline `/lender/portfolio` route test to `ENG-311`.

## Definition Of Done From Linear
- [x] Sticky rail exists with the approved hierarchy.
- [x] `Actions Required` and broker chat are both represented as first-class surfaces.
- [x] Renewal-specific content remains downstream of this host slice instead of being re-implemented here.
- [x] Fallback states are intentional and non-destructive.
- [x] Focused tests and repo validation commands pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit and focused route/component tests cover rail rendering, all-clear and missing/unavailable states, broker handoff prefills, and supported action-detail deep links.
- [x] E2E coverage is added or explicitly justified after checking whether the existing Playwright auth/portal harness can exercise the lender rail deterministically.
  Justification: the current `e2e/` suite does not include a `/lender/portfolio` route harness, so ENG-329 relies on deterministic Vitest route/component coverage instead of adding a brittle one-off Playwright path.
- [x] Storybook coverage is updated for the reusable lender portfolio surface states touched by the new rail/chat leaf components.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
