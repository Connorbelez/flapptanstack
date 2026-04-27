# Chunk 02 Context

## Existing Code

- `src/routes/index.tsx` resolves host-aware portal context and renders `MicLandingPage` for MIC public portals.
- `src/routes/portal/index.tsx` gates access with WorkOS auth, checks MIC portal context, and renders `MicDashboard`.
- `src/components/mic/query-options.ts` maps MIC UI queries to Convex functions.
- `src/test/mic/dashboard.test.tsx` covers existing dashboard rendering with mocked data.
- `src/test/routes/mic-portal-route.test.tsx` covers `/portal` authorization states.
- `e2e/helpers/host-aware-auth.ts` contains local host/origin and sign-in URL helpers.
- `e2e/auth/host-aware.spec.ts` demonstrates scoped storage-state creation and host-aware sign-in/sign-out flows.
- `playwright.config.ts` owns test projects and storage states.

## Product Contract

- MIC public landing is request-access only.
- Approved investors sign in through WorkOS/AuthKit and land on `/portal`.
- The authenticated MIC portal shows portfolio-level exposure and deal rows, not investor-specific ownership.
- Non-MIC lender positions must not appear in MIC dashboard output.

## Risk Notes

- Prefer deterministic fixtures over visual/text assertions tied to volatile dates.
- If local WorkOS authentication cannot run non-interactively, keep E2E coverage scoped to storage-state fixtures and clearly document skipped manual-auth paths.
