# Summary: ENG-308 - Lender portfolio: establish command-center contracts and source-of-truth rules

- Source issue: https://linear.app/fairlend/issue/ENG-308/lender-portfolio-establish-command-center-contracts-and-source-of
- Primary plan: https://www.notion.so/349fc1b44024816bb1f9e8d35cc6bcd8
- Supporting docs:
  - https://www.notion.so/318fc1b4402481cda6dfc6381b99d9fb
  - https://www.notion.so/349fc1b44024815a8e01d57ccc4a53f8

## Scope
- Create a dedicated `convex/portfolio` backend module for lender portfolio contracts and public query exports.
- Publish stable DTOs for cockpit metrics, positions rows, payment activity rows, action-required items, broker limits, suggested opportunities, broker coordination context, and sheet-ready detail payloads.
- Keep the public identity contract structural: portfolio reads accept `portalId` and resolve lender identity through `portalLenderQuery`, never through client-supplied lender identifiers.
- Reuse existing ledger, accrual, dispersal, portal, and listing seams instead of recomputing portfolio math or ranking logic in downstream UI code.
- Add focused backend contract tests covering empty state, unauthorized access, mid-period ownership math, ordered suggestions, broker context, and individual payment rows.

## Constraints
- This issue is backend-only. It must not take ownership of route files, React components, chart rendering, table composition, broker chat transport, or CSV generation implementation.
- Suggested opportunities must remain server-owned ordered DTOs with already-owned exclusions and explanation tags already applied.
- Payment activity must remain row-level and individual-payment based; downstream consumers must not reconstruct this from aggregates.
- Broker coordination is a thin operational data contract only: assigned broker identity, availability state, fallback contact CTA, optional thread identifier, and prefill context payloads.
- Structural auth is mandatory. The implementation must use `portalLenderQuery` and fail closed on portal/lender mismatch.
- Existing lender filter-constraint behavior should be reused rather than duplicated so suggestions and limits stay aligned with lender portal listing visibility rules.
- Ownership math stays ledger-based with `10_000` units representing 100% ownership and `1_000` units representing one fraction.
- Empty-state payloads must stay stable even when the lender has zero active positions, zero payments, or no suggested opportunities.

## Open questions
- none
