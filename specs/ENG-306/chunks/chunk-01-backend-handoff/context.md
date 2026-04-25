# Chunk Context: chunk-01-backend-handoff

## Goal
- Add the backend handoff seam that records or resumes broker-attributed lender onboarding from the public landing journey.

## Relevant plan excerpts
- "Reuse the existing `lenderOnboardings` seam instead of inventing a separate landing-page-only onboarding record."
- "Record landing source attribution structurally, including `entryPath` and broker/subdomain context, when the lender journey starts."
- "Keep the v1 attribution contract deterministic and minimal; only expand schema if current fields cannot preserve required broker/portal context."

## Implementation notes
- Add a focused Convex module under `convex/onboarding/` or equivalent.
- Use `lenderOnboardings.entryPath`, `brokerId`, and `subdomain` for v1 attribution; avoid schema changes unless implementation proves current fields insufficient.
- Handoff creation should require an active, published portal with a broker id. Inactive/unpublished/misconfigured portals must fail closed.
- Resume behavior should avoid duplicate active records for the same broker/subdomain/email/entry path family when an email is supplied.

## Existing code touchpoints
- `convex/schema.ts:lenderOnboardings`
- `convex/portals/queries.ts:getPublicPortalLandingPage`
- `convex/portals/helpers.ts`
- `convex/onboarding/mutations.ts`
- GitNexus impact must run before edits on existing symbols.

## Validation
- `bun run test -- convex/onboarding/__tests__/lenderLanding.test.ts`
- `bunx convex codegen`
