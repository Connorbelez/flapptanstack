# Execution Checklist: ENG-365 - Legal representation: add platform availability, SLA, and restriction rechecks

## Requirements From Linear
- [x] Add platform lawyer weekly availability windows and exception/hold records.
- [x] Add admin-configurable SLA tiers such as 24h review and 48h review.
- [x] Add per-platform-lawyer active deal count and capacity projection for checkout display.
- [x] Show platform lawyer card fields: name, firm, SLA tier, availability for next 3-5 business days, active deal count, and capacity warning.
- [x] Fully booked lawyers remain selectable unless suspended/restricted, but show a capacity warning.
- [x] Start SLA timer when document review work is assigned to a platform lawyer.
- [x] Track average turnaround, SLA compliance rate, completed deal count, active deal count, and breach count.
- [x] Create admin escalation/action on SLA breach.
- [x] Add periodic restriction recheck for active platform lawyers; restricted result marks lawyer requires_review/suspended and blocks new selection.
- [x] Do not automatically revoke active dealAccess on a restriction recheck; create operational review/escalation for active deals.

## Definition Of Done From Linear
- [x] Platform availability and SLA tiers are modeled as domain records.
- [x] Checkout shows availability, SLA, active deal count, and capacity warning.
- [x] SLA breach creates auditable admin escalation exactly once.
- [x] Periodic restriction rechecks produce immutable evidence and block restricted platform lawyers from new selection.
- [x] Tests cover projection, permissions, cron idempotency, and checkout display.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated where backend or domain logic changed
- [x] E2E tests added or updated where an operator or user workflow changed
  - Justification: no new route-level flow; targeted Convex and component tests cover the changed backend and checkout card states.
- [x] Storybook stories added or updated where reusable UI changed
  - Justification: no exported reusable Storybook component changed; covered by component regression tests.

## Final Validation
- [x] All requirements are satisfied
- [x] All definition-of-done items are satisfied
- [x] Required quality gates passed
- [x] Test coverage expectations were met or explicitly justified
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded
