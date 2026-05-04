# Chunk Context: chunk-01-runtime-seam

## Goal
- Define the shared renewal runtime-consumer seam for lender portfolio UI so both hosts read governed state, available actions, and mutation results from `ENG-309` without changing the runtime itself.

## Relevant plan excerpts
- "This issue is a thin consumer over the governed runtime from ENG-309."
- "Support Renew, Exit, Partial Exit, and Change Intent through the ENG-309 runtime contract."
- "Keep the UI thin: valid actions come from the runtime contract, not duplicated local business rules."
- "Do not mutate renewal status directly from the UI."

## Implementation notes
- Prefer a shared hook or query/mutation module under `src/components/lender/portfolio/renewals/` that wraps `api.renewals.portal.getLenderRenewalIntentByMortgage` and `api.renewals.portal.signalLenderRenewalIntent`.
- Reuse TanStack Query plus Convex query integration and invalidate the lender portfolio command-center and position-detail queries after successful runtime mutations.
- Avoid changing `convex/renewals/runtime.ts` or the transition engine unless the existing runtime contract is actually insufficient.

## Existing code touchpoints
- `convex/renewals/portal.ts` already exposes the runtime query and mutation surface for governed lender renewal intent handling.
- `src/components/lender/portfolio/query-options.ts` currently exposes portfolio command-center, position-detail, and payment-detail query helpers.
- `src/components/lender/portfolio/portfolio-types.ts` is the shared frontend type hub for portfolio queries and is the likely place to add renewal runtime result typing.
- GitNexus indexing succeeded, but the CLI could not resolve the portfolio TSX exports by name for symbol-level impact. Local dependency tracing shows the planned seam changes stay localized to the lender portfolio route, rail, and sheet path plus focused tests.

## Validation
- `bunx convex codegen`: not-run
- `bun typecheck`: not-run
- `bun run test -- src/test/convex/renewals/portal.test.ts`: not-run unless the runtime contract needs a backend change
