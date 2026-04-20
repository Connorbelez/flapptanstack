# Summary: ENG-300 - Broker portal: define the v1 portal pricing policy contract

- Source issue: https://linear.app/fairlend/issue/ENG-300/broker-portal-define-the-v1-portal-pricing-policy-contract
- Primary plan: https://www.notion.so/348fc1b44024816f965ceaf7e3598e7e
- Supporting docs:
  - https://www.notion.so/33ffc1b44024811aa90bd76e9e98c824
  - https://www.notion.so/33ffc1b4402481f3b1f5d84c9cf98b0b
  - https://www.notion.so/33ffc1b44024815fb1ddc83c4d4195f9
  - https://www.notion.so/33ffc1b4402480948e5ef7950f3095d4

## Scope
- Tighten the existing `portalPricingPolicies` placeholder table into an explicit v1 contract built around a flat percentage broker cut plus the minimum lifecycle fields needed for deterministic selection.
- Add one importable portal-pricing module that validates policies, selects the effective policy for a portal, and applies the projection math in exactly one place.
- Encode which listing fields are portal-projected versus which remain canonical structural mortgage fields so downstream portal listing consumers can reuse one documented contract.
- Add focused tests plus one thin proof seam using real listing query fixtures, without broad portal query or route integration work that belongs to `ENG-301`.

## Constraints
- Reuse the existing `portalPricingPolicies` table and `portals.pricingPolicyId` seam from `ENG-297`; do not introduce a second pricing store.
- The v1 formula stays intentionally minimal: one flat percentage broker cut. No per-lender repricing or broader parameter bag in this slice.
- Portal pricing is a read-time projection layer over canonical global listings inventory, not a forked listing universe.
- Published portals must fail closed when a valid active pricing policy is required but missing; unpublished portals may use explicit setup-safe behavior.
- The FairLend `app.fairlend.ca` / `app.localhost` portal follows the same pricing contract as broker portals and is not a bypass.
- Do not add a third divergent rounding implementation. Reuse a shared two-decimal rule for portal pricing math.

## Open questions
- none
