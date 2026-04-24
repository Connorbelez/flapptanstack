# Summary: ENG-332 - Velocity package: ship workspace queries, enrichment, readiness, and document linking

- Source issue: https://linear.app/issue/ENG-332
- Primary plan: https://www.notion.so/34bfc1b4402481a49f68ca893420df10
- Supporting docs:
  - https://www.notion.so/34bfc1b4402481e1a669db246c6a5869
  - https://www.notion.so/34bfc1b4402481038512d36fe9d3b2a2

## Scope
- Add staff-facing Velocity package board and detail queries.
- Add FairLend-owned enrichment and activation-remediation mutation surfaces.
- Add package document linking with explicit roles and supersession history.
- Add final-review confirmation that persists the reviewed snapshot/hash and invalidates activation readiness on normalized-hash drift.
- Add exception-resolution surface and package audit entries for staff-owned workflow events.
- Add Convex tests for board/detail DTOs, enrichment/remediation updates, PAD linking, review hash invalidation, and exception resolution.

## Constraints
- Readiness is derived from current normalized Velocity core plus FairLend-owned inputs; do not add hand-edited readiness state.
- Velocity-owned borrower, property, loan, and upstream status facts remain immutable through this slice.
- PAD evidence and supporting package documents must reference existing PDF `documentAssets` rows.
- Required package-owned activation inputs include at least `loanType` and `lienPosition`.
- Final review is valid only when the reviewed snapshot hash matches the current normalized core hash.
- Package lifecycle audit entries are required; enrichment state is not the audit trail.
- Use fluent-convex exports with explicit `.public()` or `.internal()`.

## GitNexus Impact
- `computeVelocityReadiness`: LOW risk; 1 direct caller in `convex/velocity/sync.ts`, imported downstream by `convex/velocity/webhook.ts`, `convex/velocity/index.ts`, and `convex/http.ts`; no affected processes reported.
- `resolveWorkspaceState`: LOW risk; 1 direct caller in `convex/velocity/sync.ts`, imported downstream by `convex/velocity/webhook.ts`, `convex/velocity/index.ts`, and `convex/http.ts`; no affected processes reported.

## Open questions
- none
