# Spec Audit: ENG-306 - Broker landing page: wire lender CTA and broker-attributed onboarding handoff

- Audit skill: `$linear-pr-spec-audit`
- Review target: `codex/eng-306-lender-handoff` branch diff against base commit `31d8ff1`
- Last run: 2026-04-25T19:43:49Z
- Verdict: needs manual validation

## Findings
- Review findings have been addressed.
- `convex/onboarding/lenderLanding.ts`: resume path now refreshes `machineContext.landingSource` while preserving unrelated existing machine context.
- `convex/onboarding/lenderLanding.ts`: entry path validation now parses the URL and requires canonical pathname `/start-lending` plus an allowed source.
- `src/routes/start-lending.tsx`: already-authenticated users now go directly to `/start-lending/complete`.
- `src/routes/start-lending.complete.tsx`: completion mutation now runs through a server function that obtains WorkOS auth and uses an authenticated `ConvexHttpClient`.
- The implementation satisfies the canonical landing handoff contract: switchboard lender CTA, featured listing cards, and `View All` all resolve to `/start-lending` URLs and converge on `/start-lending/complete`.
- The backend reuses `lenderOnboardings`, records broker id, portal subdomain, entry path, and listing source attribution, and resumes active onboarding records for the same lender and broker context.
- Invalid or unavailable portal hosts remain fail-closed through `assertActivePortalId` and active/published portal checks.
- Demo and mock onboarding paths were not imported by the new handoff flow.

## Unresolved items
- Manual validation remains for the full WorkOS hosted-auth browser round trip because the local targeted suite covers the route and Convex contracts but does not exercise the external hosted auth service.

## Next action
- Optional manual browser smoke test through hosted WorkOS auth on a portal host.
