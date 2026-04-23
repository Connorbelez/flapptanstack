# Summary: ENG-318 - Broker onboarding: build regulator lookup abstraction and FSRA import pipeline

- Source issue: https://linear.app/fairlend/issue/ENG-318/broker-onboarding-build-regulator-lookup-abstraction-and-fsra-import
- Primary plan: https://www.notion.so/349fc1b4402481aeada3d3e741c05217
- Supporting docs:
  - https://www.notion.so/30ffc1b440248007a921c855c6e6adfa
  - https://www.notion.so/317fc1b44024811298e9f5e5018ca01d
  - https://www.notion.so/349fc1b44024811ba33ee1ec188bea12

## Scope
- Extend the broker-onboarding regulator seam so downstream code can request normalized individual-license and brokerage lookups behind one provider abstraction.
- Add typed Convex storage for imported FSRA regulator data and refresh-run tracking with the exact fields required by the issue and plan.
- Implement normalization, upsert, freshness, and imported-data lookup helpers for Ontario FSRA rows while keeping province extensible in contracts and schema.
- Upgrade the imported-data and mock regulator providers to emit the same normalized results, including stale, unavailable, not-found, suspended, revoked, inactive, and brokerage-mismatch cases.
- Add one shared refresh orchestration seam plus an admin-triggerable manual refresh action and a daily cron entry.
- Add focused backend tests and final validation for the producer slice; no onboarding UI or verification-policy decisioning is in scope.

## Constraints
- Do not make live FSRA scraping or a live regulator API a dependency of the onboarding critical path.
- Keep launch Ontario-only, but preserve province in schema and provider contracts for future regulators.
- Keep raw source payloads available for audit/debugging without forcing downstream consumers to parse `rawRecord`.
- Use `fluent-convex` exports with explicit `.public()` or `.internal()` visibility and keep auth wired through middleware.
- Keep the provider mockable and strategy-selected; do not scatter regulator branching across routes, actions, or mutations.
- Manual refresh must stay behind the explicit `onboarding:manage` boundary and share the same orchestration path as cron.
- This issue is a producer boundary only. Do not implement onboarding UI, three-way verification policy decisions, or broker-application lifecycle work here.

## Open questions
- none
