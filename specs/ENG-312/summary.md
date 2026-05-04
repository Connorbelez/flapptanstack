# Summary: ENG-312 - Lender portfolio: ship renewal actions inside the rail and position sheet

- Source issue: https://linear.app/fairlend/issue/ENG-312/lender-portfolio-ship-renewal-actions-inside-the-rail-and-position
- Primary plan: https://www.notion.so/349fc1b440248111bec1f9950b172e06
- Supporting docs:
  - https://www.notion.so/318fc1b4402481cda6dfc6381b99d9fb
  - https://www.notion.so/349fc1b44024815a8e01d57ccc4a53f8
  - https://www.notion.so/349fc1b44024815d9f24e9f7625bb88e

## Scope
- Ship shared renewal-specific UI under `src/components/lender/portfolio/renewals/` so the rail host and position-sheet host render the same governed state and action affordances.
- Consume the governed renewal runtime from `ENG-309` for Renew, Exit, Partial Exit, and Change Intent instead of duplicating client-side business rules.
- Render renewal-specific action content inside the generic `Actions Required` host from `ENG-329` and inside the position sheet owned by `ENG-311`.
- Cover partial-exit validation UX, expired or matured non-actionable states, and stale-state refresh behavior when renewal intent changes elsewhere.
- Add focused renewal UI tests and Storybook coverage for shared states.

## Constraints
- Do not take ownership of the rail shell, broker chat shell, route host, or governed transition runtime in this issue.
- Do not mutate renewal status directly from the UI; all valid actions and state transitions must come from the renewal runtime contract.
- Do not create or require a dedicated renewal route; renewal work stays inside the command-center hosts.
- Do not trust client-supplied lender or mortgage ownership; keep using portal-scoped auth and runtime seams.
- Expired, matured, or sold-out renewal states must remain visible with clear explanation but no actionable controls.
- Partial exit must respect the runtime minimum and the lender's current held-position ceiling.

## Open questions
- none
