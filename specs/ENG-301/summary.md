# Summary: ENG-301 - Broker portal: ship portal listing queries and thin route consumers

- Source issue: https://linear.app/fairlend/issue/ENG-301/broker-portal-ship-portal-listing-queries-and-thin-route-consumers
- Primary plan: https://www.notion.so/349fc1b440248152b73ddcf88614b510
- Supporting docs:
  - https://www.notion.so/33ffc1b4402480948e5ef7950f3095d4
  - https://www.notion.so/33ffc1b4402481f3b1f5d84c9cf98b0b
  - https://www.notion.so/33ffc1b44024815fb1ddc83c4d4195f9
  - https://www.notion.so/33ffc1b4402481c09241dfde51649b24

## Scope
- Add explicit portal-aware listing query contracts on top of the landed `eng-297` through `eng-300` stack instead of relying on generic listing endpoints with optional `portalId`.
- Ship a public teaser consumer on `/` for valid portal hosts using the root `portalContext` and persisted FairLend default `app` portal contract.
- Ship an authenticated lender listings consumer on `/lender/listings` plus a portal-aware detail read path on `/lender/listings/$listingId`.
- Clamp lender-submitted filters server-side from `lenderFilterConstraints` and keep projected listing values aligned across teaser, list, and detail reads.
- Reuse the production-safe listing/map/filter components already under `src/components/listings` and avoid any dependency on demo broker-whitelabel code.

## Constraints
- This worktree initially started detached on `main`, which does not contain the upstream portal stack; implementation must proceed on top of `eng-300`, not `main`.
- `app.fairlend.ca` and `app.localhost:3000` are the canonical FairLend in-house portal hosts and must continue to resolve through the persisted portal registry, not a route-local fallback.
- Portal-sensitive Convex queries must use explicit portal-aware builders such as `portalPublicQuery` and `portalLenderQuery`.
- Wrong-host and unavailable-host handling already lives in `src/routes/__root.tsx` and `PortalStateBoundary`; this issue should add only in-surface empty or teaser-disabled states for valid portal hosts.
- Existing production listing surfaces use TanStack Query plus the portal-scoped hash in `src/router.tsx`; new portal consumers should stay on that path so host cache isolation applies to real listing reads.
- GitNexus impact on `listPublishedListings` and `getListingWithAvailability` is `LOW`; GitNexus symbol lookup is sparse for `portalLenderQuery` and `withPortalFilterBounds`, so those seams require direct code inspection before edits.

## Open questions
- none
