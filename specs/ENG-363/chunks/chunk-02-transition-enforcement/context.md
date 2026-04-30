# Chunk Context: chunk-02-transition-enforcement

## Goal
- Enforce the legal gates on the backend paths that can emit `LAWYER_VERIFIED` and `REPRESENTATION_CONFIRMED`.

## Relevant Plan Excerpts
- "`LAWYER_VERIFIED` is valid only when selected lawyer exists, current eligible LSO/bar evidence exists for the selected lawyer and deal/platform profile, disqualifying restrictions are absent, and active lawyer dealAccess exists or can be created by the transition effect."
- "`REPRESENTATION_CONFIRMED` is valid only when deal status is `lawyerOnboarding.verified`, the acting lawyer has active authorized access for the selected lawyer, eligible verification evidence is still current, and a signed or accepted `representationEngagements` row exists for the same deal/lawyer."

## Implementation Notes
- `confirmRepresentation` currently checks active access and status, then calls `executeTransition`.
- Admin/manual transition paths need the same evidence guard; prefer enforcing in the deal transition command path or central preflight before `executeTransition`.
- Preserve `approveDocuments` package blockers.

## Existing Code Touchpoints
- `convex/deals/lawyerMutations.ts`
- `convex/deals/mutations.ts`
- `convex/engine/commands.ts`
- `convex/engine/transition.ts`
- `convex/engine/types.ts`
- `convex/engine/machines/deal.machine.ts` only if payload typing requires update

## Validation
- targeted `lawyerWorkspace` backend tests
- targeted engine/transition tests or full `bun run test`
