# Execution Checklist: ENG-304 - Broker landing page: add broker customization and theming after v1 launch

## Requirements From Linear
- [x] Extend the landing-page contract with a constrained set of customization fields that sit on top of the fixed-template IA.
- [x] Keep the renderer structurally shared; customization must change tokens, copy, imagery, and allowed trust-strip content, not layout composition.
- [x] Preserve lender vs borrower or mortgage-applicant as the top-level split.
- [x] Preserve pre-approval as a nested financing action.
- [x] Preserve the product-like featured-listing presentation.
- [x] Prefer a staff-managed configuration surface or seed or mutation path before broker self-serve tooling.
- [x] Keep the customization schema additive to the v1 contract rather than parallel to it.
- [x] Document which fields are safe to customize and which remain fixed.
- [x] Avoid introducing a full CMS, arbitrary block editor, or freeform theming engine.

## Definition Of Done From Linear
- [x] The shared landing renderer can consume constrained copy and theme overrides without forking the IA.
- [x] Brokers can vary brand expression within the approved v1 structure.
- [x] The product-like teaser, CTA hierarchy, and financing split remain intact.
- [x] The customization data contract stays smaller than a general CMS or block editor.
- [x] Post-v1 customization does not break downstream lender or borrower handoff behavior.

## Agent Instructions
- Keep this file current as work progresses.
- Do not mark an item complete unless code, tests, and validation support it.
- If an item is blocked or inapplicable, note the reason directly under the item.

## Test Coverage Expectations
- [x] Unit tests added or updated for backend landing contract fallbacks, theme overrides, safe validation, and staff mutation behavior.
- [x] Route/component tests added or updated for renderer application of theme/customization while preserving v1 IA.
- [x] E2E tests are not required unless this implementation changes a real browser workflow beyond renderer output.
- [x] Storybook stories are not required because this repo does not currently expose Storybook for the portal landing components.

## Final Validation
- [x] All requirements are satisfied.
- [x] All definition-of-done items are satisfied.
- [x] `bunx convex codegen` passed.
- [x] `bun check` passed.
- [x] `bun typecheck` passed.
- [x] Targeted tests passed.
- [x] Final `$linear-pr-spec-audit` review passed or blockers are explicitly recorded.
