# Execution Checklist: ENG-312 - Lender portfolio: ship renewal actions inside the rail and position sheet

## Requirements From Linear
- [x] Surface pending renewal work in `Actions Required` through the generic rail host from `ENG-329`, with deadline and mortgage context.
- [x] Expose renewal state and actions inside the position sheet’s Renewal tab/section.
- [x] Support Renew, Exit, Partial Exit, and Change Intent.
- [x] Keep partial-exit validation aligned with the runtime and the product minimum.
- [x] Expired or matured intents must be visible but non-actionable with a clear explanation.
- [x] Do not require a dedicated renewal route unless the implementation proves it is necessary later.
- [x] Keep the UI thin: valid actions come from the runtime contract, not duplicated local business rules.
- [x] Publish shared renewal-specific components so the rail host and sheet host cannot drift.

## Definition Of Done From Linear
- [x] Renewal-specific content is reachable from the command center without a dedicated route.
- [x] The rail host and position-sheet host render the same governed renewal state and available actions.
- [x] Partial-exit and expired-state behavior are test-covered.
- [x] Renewal UI does not duplicate the runtime business rules from `ENG-309`.
- [x] Repo validation commands pass.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit and integration tests added or updated for renewal UI behavior, runtime-driven choices, partial-exit validation UX, expired-state presentation, and stale refresh.
- [x] E2E coverage added or explicitly justified as unnecessary for this host-only command-center slice.
  Host-only command-center changes are covered by focused RTL route/rail tests plus helper/component tests. No dedicated route, provider integration, or browser-only flow was introduced in this slice.
- [x] Storybook stories added or updated for shared renewal-specific components and key states.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
