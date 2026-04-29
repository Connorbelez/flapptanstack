# Execution Checklist: ENG-318 - Broker onboarding: build regulator lookup abstraction and FSRA import pipeline

## Requirements From Linear
- [x] Introduce a launch-ready imported-data source for Ontario FSRA license records that can answer both brokerage and individual license queries.
  Manual validation note: deployed refresh jobs still need a real supplier of normalized FSRA rows; the implementation now imports explicit records and fails visibly instead of seeding hidden fixtures.
- [x] Preserve province in the schema and provider contracts even though launch only enables Ontario.
- [x] Normalize brokerage and individual lookup results so downstream verification code can detect active, suspended, revoked, inactive, not-found, stale, and unavailable states without reading raw records.
- [x] Provide a deterministic mock implementation with fixtures covering happy path, not-found, suspended, stale, and brokerage-mismatch cases.
- [x] Implement a repeatable import or refresh workflow that records when the source was imported and when a row was last verified.
- [x] Expose an admin-triggerable manual refresh path for edge cases without making the user-facing onboarding path wait on live scraping.
- [x] If imported data is older than 7 days, return an explicit stale or verification-unavailable result that downstream verification maps to review-needed rather than hard rejection.
- [x] Keep raw source records available for audit or debugging, but do not force downstream consumers to parse them.

## Definition Of Done From Linear
- [x] `fsraLicenses` or equivalent imported regulator storage exists with typed indexes.
- [x] A deterministic mock provider and an imported-data provider both satisfy the shared contract.
- [x] Import and refresh workflows are test-covered and operationally understandable.
- [x] Downstream code can ask for brokerage or individual-license lookups without touching raw source records.
- [x] The user-facing path no longer assumes live regulator access.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for normalization/upserts, provider lookup behavior, freshness mapping, refresh orchestration, and manual refresh behavior.
- [x] E2E tests added or updated where an operator or broker workflow changed.
  Not expected for the planned scope because this issue does not ship a browser-facing flow or UI surface.
- [x] Storybook stories added or updated where reusable UI changed.
  Not expected for the planned scope because this issue is backend-only and explicitly excludes onboarding UI.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] Required quality gates passed.
- [x] Test coverage expectations were met or explicitly justified.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
