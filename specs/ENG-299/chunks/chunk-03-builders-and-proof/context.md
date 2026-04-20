# Chunk Context: chunk-03-builders-and-proof

## Goal
- Expose reusable portal-aware fluent-convex builders and add a thin proof consumer so downstream portal-sensitive queries can adopt the new structural access layer without recreating it.

## Relevant plan excerpts
- Expose reusable portal-aware builders instead of shipping standalone exported helper functions.
- Because there is not yet a real portal listing query surface in this repo, land reusable builders plus a thin proof consumer or test seam here and leave broader product adoption to `ENG-301`.

## Implementation notes
- `convex/fluent.ts` currently exposes auth, org, role, and permission chains but no portal-aware builders.
- Portal builders should compose trusted portal resolution first, then auth and portal access, then actor-specific middleware where needed.
- The proof consumer should be intentionally narrow: enough to exercise the builder chain and typed `ctx.portal`, but not a broad rewrite of unrelated product queries.
- If `convex/authz/resourceAccess.ts` needs changes, they should only reflect shared actor-resolution reuse or typed context compatibility, not hidden portal checks.

## Existing code touchpoints
- `convex/fluent.ts`
- `convex/authz/resourceAccess.ts`
- `convex/portals/queries.ts`
- prospective proof module: `convex/portals/proof.ts`

## Validation
- Proof consumer or harness can be called through the new portal-aware builders
- `convex/fluent.ts` still exports explicit `.public()` or `.internal()` endpoints only
