# Summary: ENG-300 - Broker portal runtime pricing productionization

- Source issue: https://linear.app/fairlend/issue/ENG-300/broker-portal-define-the-v1-portal-pricing-policy-contract
- Primary plan: https://www.notion.so/348fc1b44024816f965ceaf7e3598e7e
- Supporting docs:
  - https://www.notion.so/33ffc1b44024811aa90bd76e9e98c824
  - https://www.notion.so/33ffc1b4402481f3b1f5d84c9cf98b0b
  - https://www.notion.so/33ffc1b44024815fb1ddc83c4d4195f9
  - https://www.notion.so/33ffc1b4402480948e5ef7950f3095d4

## Scope
- Productionize portal pricing in runtime code instead of leaving it as helper-only contract work.
- Fail closed at the root portal boundary for published portals whose selected pricing policy is missing or invalid, while exposing only a generic public misconfiguration state.
- Thread portal-aware pricing through real listing detail and published-list query paths, projecting only portal-priced fields and leaving canonical structural listing fields unchanged.
- Add a temporary admin control under `/admin/settings` that stores a broker-global portal adjustment, defaults to a persisted `0%`, and fans that value out into per-portal selected pricing policies.
- Keep the FairLend app portal on the same pricing runtime contract, but pin it to its own persisted `0%` policy and exclude it from broker-global adjustments.

## Delivered changes
- Added a singleton `brokerPortalPricingSettings` control-plane table and helper layer that guarantees a persisted default `brokerSplitPercent = 0`.
- Added idempotent portal policy synchronization so portal bootstrap, broker portal backfill, and backfill repair all produce one selected active policy per portal.
- Extended portal host resolution to return backend-owned `availability`, including a new public `"misconfigured"` state for published pricing failures.
- Updated the portal root boundary and route context to trust backend availability instead of inferring it locally.
- Wired `getListingWithAvailability` and `listPublishedListings` to require a ready portal pricing selection when `portalId` is supplied and to project only `interestRate` and `monthlyPayment`.
- Added `/admin/settings` broker portal pricing UI plus backend fan-out mutation coverage.
- Updated ENG-300 artifacts to reflect the widened runtime scope and removed the stale note that described runtime wiring as unresolved current work.

## Constraints
- Reuse the existing `portalPricingPolicies` table and `portals.pricingPolicyId` seam from `ENG-297`; do not introduce a second runtime pricing store.
- The v1 broker portal formula remains one flat percentage broker cut. No per-lender or per-portal override UI is introduced in this slice.
- Runtime code never silently treats missing or malformed pricing as `0%`; the persisted `0%` default is materialized as real policy data.
- The public pre-auth portal contract exposes only generic availability states. Detailed pricing failure reasons remain backend-only and test-only.
- The FairLend `app.fairlend.ca` / `app.localhost` portal remains a first-class pricing consumer rather than a bypass path.

## Open questions
- none
