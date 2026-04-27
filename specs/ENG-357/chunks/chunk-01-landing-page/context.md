# Chunk 1 Context: Public Landing Page

## Goal
Build the public MIC landing page accessible without auth on the MIC host. It must have:
1. MIC-specific landing content
2. Email request form for "Request offering memorandum / prospectus"
3. Generic success state (do NOT expose whether email is already approved/invited/rejected)
4. WorkOS sign-in CTA that preserves MIC host/portal context through auth completion

## Existing Code to Reference

### Current `src/routes/index.tsx`
The root route already branches on portal type:
```tsx
function PortalHomeContent({ portalContext }: { portalContext: ActivePortalContext }) {
  const protectedPortalPath =
    portalContext.portal.portalType === "mic" ? "/portal" : "/listings";
  // ... renders generic portal home with teaser listings
}
```

For MIC portals, instead of the generic portal home, render a dedicated `MicLandingPage`.

### Public Access Request Mutation (ENG-353)
`convex/micInvestorAccessRequests/mutations.ts`:
```tsx
export const submitPublicRequest = convex
  .mutation()
  .input({ email: v.string(), portalId: v.id("portals") })
  .returns(micInvestorAccessRequestSubmitResultValidator)
  .handler(async (ctx, args) => {
    const normalizedEmail = normalizeMicInvestorAccessRequestEmail(args.email);
    // ... dedupes by email+portal+status, returns generic success for duplicates
  })
  .public();
```

The mutation is idempotent — duplicate pending requests return the same generic success. Rejected emails may submit again.

### Submit Result Validator
`convex/micInvestorAccessRequests/validators.ts`:
```tsx
export const micInvestorAccessRequestSubmitResultValidator = v.object({
  received: v.boolean(),
  message: v.string(),
});
export const MIC_INVESTOR_ACCESS_REQUEST_RECEIVED = {
  received: true,
  message: "Your request has been received. We will review it and get back to you shortly.",
};
```

### Sign-in Pattern
From `src/routes/index.tsx`:
```tsx
<Button asChild>
  <a href={`/sign-in?redirect=${protectedPortalPath}`}>Sign in</a>
</Button>
```
For MIC, `protectedPortalPath` should be `/portal`.

### Portal Context Access
```tsx
const { portalContext } = RootRoute.useRouteContext();
// portalContext.portal.portalId — the portal ID to pass to mutations
// portalContext.portal.slug — e.g. "mic"
```

### Form Validation Requirements
- Local validation: valid email format
- Server validation: same email normalization happens server-side
- Generic success for ALL valid submissions (including duplicates)
- Do NOT expose whether email is approved, invited, or rejected

### Component Patterns
Use ShadCN UI components: `Button`, `Card`, `CardContent`, `CardHeader`, `CardTitle`, `Input`, `Label`.
Use Tailwind for styling. Keep it simple and functional.

### Auth Pattern
The landing page is PUBLIC — no `Authenticated`/`AuthLoading` wrapper needed.
The sign-in button just links to `/sign-in?redirect=/portal`.

### File Location
Create `src/components/mic/MicLandingPage.tsx`.
Modify `src/routes/index.tsx` to branch to it.
