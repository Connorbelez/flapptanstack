# Chunk Context: chunk-01-platform-lawyer-backend

## Goal
- Deliver backend profile management, status changes, checkout option projection, and seed/admin path for platform lawyers.

## Relevant plan excerpts
- "Do not add WorkOS roles named `platform_lawyer` or `guest_lawyer`."
- "Admin management must be server-authorized with `requireFairLendAdmin`-equivalent checks."
- "`PlatformLawyerOption` includes lawyerProfileId, lawyerId WorkOS authId, name, email, firm, jurisdiction, barNumber, eligibilityStatus, platformStatus, and latestVerificationId."

## Implementation notes
- Create `convex/legalRepresentation/profiles.ts` for local helpers and `convex/legalRepresentation/platformLawyers.ts` for exported fluent-convex APIs.
- Use `adminQuery`/`adminMutation` from `convex/fluent.ts` where available.
- Use latest `manual_admin`, `platform_periodic`, or `fresh_restriction` verification evidence to project selection eligibility.
- Use immutable `lawyerVerifications` rows as equivalent evidence for status changes unless a more specific audit helper is already clearly reusable.

## Existing code touchpoints
- `convex/schema.ts`: `lawyerProfiles`, `lawyerVerifications`, and indexes already exist from ENG-359.
- `convex/legalRepresentation/verifications.ts`: currentness and checkpoint decisions.
- `convex/legalRepresentation/fixtures.ts`: platform lawyer fixture base.
- GitNexus impact pending before editing existing symbols.

## Validation
- Targeted Convex tests for platform lawyer management and eligibility.
- `bunx convex codegen`, `bun check`, `bun typecheck`.
