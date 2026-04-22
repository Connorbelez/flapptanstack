# Summary: ENG-311 - Lender portfolio: ship command-center route, ledgers, and detail sheets

- Source issue: https://linear.app/fairlend/issue/ENG-311/lender-portfolio-ship-command-center-route-ledgers-and-detail-sheets
- Primary plan: https://www.notion.so/349fc1b440248155bc7aeb9be55160ba
- Supporting docs:
- https://www.notion.so/318fc1b4402481cda6dfc6381b99d9fb
- https://www.notion.so/349fc1b44024815a8e01d57ccc4a53f8
- https://www.notion.so/349fc1b44024815d9f24e9f7625bb88e

## Scope
- Add the single `src/routes/lender.portfolio.tsx` route under the existing lender boundary with portal-aware loading and a shared route/query consumer seam over `convex/portfolio/queries.ts`.
- Build the page-level command-center scaffold with stable named slot hosts for cockpit, lower export strip, suggested opportunities, and the sticky rail while keeping this issue out of the downstream leaf ownership owned by `ENG-312`, `ENG-313`, `ENG-314`, and `ENG-329`.
- Render the positions ledger first and the payment activity ledger second, each with route-backed filter and sort controls and row selection wired to detail hosts.
- Implement desktop full-height right-side sheet hosts and mobile drawer fallbacks for position and payment detail contracts without creating separate portfolio detail subroutes.
- Ship route-level empty, loading, and error states, the baseline `/lender/portfolio` route test, Storybook coverage for the reusable portfolio surface, repo validations, and the final spec-compliance audit.

## Constraints
- Keep everything under the existing `/lender/*` workspace and do not create `/investor/*` routes or separate portfolio detail subroutes.
- Treat `convex/portfolio/queries.ts` and `convex/portfolio/contracts.ts` as the source of truth; the frontend must pass `{ portalId }` and must not recalculate lender ownership, payment math, or suggestion ranking locally.
- Preserve the approved composition order: cockpit slot, positions ledger, payment ledger, export-strip slot, suggested-opportunities slot, with the sticky rail hosted alongside the page and collapsing inline on smaller screens.
- Keep payment activity as individual payment rows, not aggregated rollups, and keep sheet interiors as a single stacked column instead of card-heavy sidebars.
- Do not absorb cockpit/export visuals, suggested-opportunity rendering, renewal-specific action content, or sticky rail / broker chat internals into this issue.
- Prefer additive new route/component files; if implementation later requires editing an existing symbol, run GitNexus impact analysis before touching it.

## Open questions
- none
