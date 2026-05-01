# Summary: ENG-365 - Legal representation: add platform availability, SLA, and restriction rechecks

- Source issue: https://linear.app/fairlend/issue/ENG-365/legal-representation-add-platform-availability-sla-and-restriction
- Primary plan: https://www.notion.so/350fc1b44024813fbdecf6fb65199ee8
- Supporting docs:
  - https://www.notion.so/313fc1b44024812691b3fa077308a1af
  - docs/convex/convex-dev-crons.md

## Scope
- Add domain records for platform lawyer availability windows, exception/hold periods, SLA tiers, SLA assignments, SLA review timers/metrics, and operational escalations.
- Add backend APIs for admin SLA configuration, admin/lawyer availability management, checkout selection projections, SLA breach checks, and periodic restriction rechecks.
- Add checkout display fields for platform lawyer SLA, next 3-5 business days availability, active deal count, and capacity warning.
- Add tests for projection, permissions, cron idempotency, restriction evidence, and checkout display.

## Constraints
- Availability/SLA belongs to the legal representation domain, not WorkOS RBAC.
- Fully booked lawyers remain selectable with warning; suspended, restricted, stale, unavailable hold, or requires-review lawyers are blocked for new selection.
- SLA breach and restriction recheck jobs must not mutate deal status or auto-reassign lawyers.
- Restriction rechecks must write immutable `lawyerVerifications` evidence rows and use idempotency to avoid duplicates.
- Cron handlers must be bounded and index-backed.
- SLA start event choice: use the first observed deal `documentReview.pending` status timestamp for selected platform lawyers in this slice because there is no dedicated document assignment timestamp in the current legal representation schema.

## Open questions
- None blocking. Capacity enforcement ambiguity is resolved in favor of warning-only over-capacity behavior per the dependency contract.
