# Chunk Context: chunk-01-contracts-and-routes

## Goal
- Create the public financing continuation route family outside `/borrower` and define the minimal prefill/resume contract.

## Relevant plan excerpts
- "Introduce dedicated public financing-start routes outside the auth-gated `/borrower` tree."
- "Define a minimal resume/prefill contract for the inline strip so the three captured fields can continue downstream without making the landing page stateful and complex."
- "Keep invalid or unavailable portal hosts fail-closed."

## Implementation notes
- Add `/financing/start` for general borrower or mortgage-applicant intake continuation.
- Add `/financing/pre-approval` as the nested pre-approval continuation inside the same route family.
- Parse only `fullName`, `email`, and `amountNeeded` from query search.
- Use `RootRoute.useRouteContext()` for the resolved portal context rather than reparsing hostnames.
- Do not use `/borrower/*` as an anonymous landing target.
- Backend create/resume is optional in this chunk unless route behavior needs persistent provisional state; the likely safe v1 is a public continuation surface that preserves attribution and prompts auth/continuation before record creation.

## Existing code touchpoints
- `src/routes/index.tsx` currently renders `PortalLandingPage` on portal hosts.
- `src/routes/__root.tsx` already fails closed for blocked portal hosts and suppresses shared header on public portal root.
- `src/components/portal/landing/PortalLandingPage.tsx` renders CTA links and inline-strip GET form.
- `convex/portals/queries.ts` builds default borrower actions as `/financing/start` and `/financing/pre-approval`.
- `convex/schema.ts` has `borrowers.portalId`, `onboardingRequests.portalId`, `provisionalApplications`, and `provisionalOffers`.
- `convex/portals/middleware.ts` resolves borrowers through explicit `portalId` via `by_portal_user`.

## Validation
- `python3 scripts/validate_execution_artifacts.py ENG-307 --repo-root "/Users/connor/.codex/worktrees/da0e/fairlendapp" --stage ready-to-edit`
- GitNexus impact for changed existing symbols before edits.
- Targeted route tests for public financing continuation and prefill parsing.
