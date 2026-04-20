# Execution Checklist: ENG-300 - Broker portal: define the v1 portal pricing policy contract

## Requirements From Linear
- [x] Formalize `portalPricingPolicies` around a flat-percentage broker cut and reuse the existing `pricingPolicyId` seam.
- [x] Add the minimum lifecycle fields and deterministic active-policy selection rules needed to choose one portal policy.
- [x] Implement one shared portal-pricing helper and one rounding rule; do not duplicate formulae across queries or UI components.
- [x] Document and test which listing outputs are portal-projected versus which remain canonical structural fields.
- [x] Fail closed for published portals missing a valid active pricing policy, with explicit setup-safe behavior for unpublished portals if supported.
- [x] Keep per-lender pricing out of scope and leave broad portal-listings integration to `ENG-301`.

## Definition Of Done From Linear
- [x] A typed v1 portal-pricing contract exists in schema and code.
- [x] One deterministic active policy can be selected for a portal.
- [x] One reusable helper owns portal-pricing math and downstream consumers can import it directly.
- [x] Missing or inactive pricing on published portals fails explicitly.
- [x] `bunx convex codegen`, `bun check`, `bun typecheck`, and targeted portal-pricing tests pass.
`bun check` still surfaces pre-existing repo-wide complexity warnings outside the `ENG-300` diff, but the command exits successfully and does not block closeout.

## Plan-Derived Contract Checks
- [x] The FairLend `app` portal participates in the same portal-pricing contract as broker portals rather than bypassing the helper.
- [x] Portal pricing remains a read-time projection over canonical listing inventory instead of mutating stored listing values.
- [x] Only portal-facing return-like listing outputs are projected in v1; structural fields such as principal, lien position, LTV, and maturity remain canonical.
- [x] The active-policy selector handles future-dated rows, invalid references, and overlapping active windows deterministically.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests cover validator rules, selection rules, projection math, and fail-closed behavior.
- [x] A thin integration proof uses real listing query fixtures plus the shared portal-pricing helper.
- [x] E2E coverage is explicitly marked not applicable here because live portal-listing route wiring lands in `ENG-301`.
- [x] Storybook work is explicitly marked not applicable because this repo does not define a Storybook workflow.

## Final Validation
- [x] All requirements are satisfied
- [x] All definition-of-done items are satisfied
- [x] Required quality gates passed
- [x] Test coverage expectations were met or explicitly justified
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded
