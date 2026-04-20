# Chunk Context: chunk-01-contract-schema

## Goal
- Replace the `ENG-297` placeholder `portalPricingPolicies` shape with an explicit v1 contract and matching validators while preserving the existing `portals.pricingPolicyId` seam.

## Relevant plan excerpts
- `Formalize the v1 portal-pricing schema around a flat percentage broker cut instead of an untyped or placeholder-only bag.`
- `Reuse portalPricingPolicies and portals.pricingPolicyId rather than introducing a second pricing store.`
- `Add the minimum lifecycle fields and rules required to select exactly one active policy deterministically.`

## Implementation notes
- Keep the formula itself minimal. Lifecycle additions should only support deterministic selection and setup-safe behavior.
- Reuse the existing table and portal attachment point instead of redesigning portal ownership or introducing per-lender pricing.
- Prefer explicit schema comments that encode the now-resolved product decision so downstream work does not reopen the flat broker-cut contract.

## Existing code touchpoints
- `convex/schema.ts`
- `convex/portals/validators.ts`
- `convex/portals/queries.ts` only as a reference for existing portal summary types and the `pricingPolicyId` seam
- GitNexus note: schema/table edits are not modeled directly by the CLI, so this chunk relies on focused regression coverage in addition to the low-risk impacts already captured for listing query consumers

## Validation
- `bunx convex codegen`
- targeted portal-pricing contract tests once they exist
