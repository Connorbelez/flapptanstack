# Summary: ENG-329 - Lender portfolio: ship actions-required rail and broker chat surface

- Source issue: https://linear.app/fairlend/issue/ENG-329/lender-portfolio-ship-actions-required-rail-and-broker-chat-surface
- Primary plan: https://www.notion.so/349fc1b4402481ae806dd070c3a329a9
- Supporting docs:
  - https://www.notion.so/318fc1b4402481cda6dfc6381b99d9fb
  - https://www.notion.so/349fc1b44024815a8e01d57ccc4a53f8
  - https://www.notion.so/349fc1b44024815d9f24e9f7625bb88e

## Scope
- Replace the sticky-rail placeholder blocks in `src/components/lender/portfolio/LenderPortfolioPage.tsx` with the real `Actions Required` host and broker chat surface while preserving the route-owned shell delivered by ENG-311.
- Add reusable rail leaf components in `src/components/lender/portfolio/action-item-host.tsx`, `src/components/lender/portfolio/actions-rail.tsx`, and `src/components/lender/portfolio/broker-chat-panel.tsx`.
- Implement contextual handoff and prefill selection from rail actions into the broker coordination panel without taking ownership of the route shell, shared query seam, or renewal-specific business rules.
- Add focused rail/chat coverage in `src/test/lender/portfolio-rail.test.tsx`, update Storybook states for the lender portfolio page, and close the repo validation plus spec-audit gates.

## Constraints
- Consume the explicit broker-coordination contract from ENG-308 as-is; do not invent broker identity, availability, thread state, or prefill payloads locally in React.
- Keep `Actions Required` above broker chat and preserve all-clear, unavailable-chat, and missing-broker states instead of removing the rail.
- Keep the broker surface day-one single-thread or assigned-contact oriented; do not turn this slice into a generic inbox or messaging-platform build.
- Keep renewal-specific content downstream of this host slice and avoid duplicating renewal rules or route/query ownership that belong to ENG-311 and ENG-312.
- Use the existing ShadCN/Tailwind patterns and the approved right-rail hierarchy rather than introducing a new layout system.
- Pre-edit GitNexus impact for `LenderPortfolioPage` is `LOW` risk in the current worktree after reindexing, with no tracked upstream callers or affected processes.

## Open questions
- none
