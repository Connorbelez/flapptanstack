# Chunk 1: Public Landing Page

## Tasks

- [ ] T-001: Add `src/components/mic/MicLandingPage.tsx` with email request form, generic success state, and WorkOS sign-in CTA preserving MIC context.
- [ ] T-002: Wire `src/routes/index.tsx` to render `MicLandingPage` when `portalContext.portal.portalType === "mic"` instead of generic portal home.
- [ ] T-003: Connect email form to `api.micInvestorAccessRequests.submitPublicRequest` Convex mutation with loading/error states and generic success for duplicates.
