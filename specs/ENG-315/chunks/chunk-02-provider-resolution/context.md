# Chunk Context: chunk-02-provider-resolution

## Goal
- Build the registry-selected provider seam, deterministic adapters, and WorkOS-backed email-verification contract that downstream business logic can call without branching on vendor details.

## Relevant plan excerpts
- "Add strategy-selected provider resolution plus deterministic mock adapters and a placeholder imported-data regulator adapter surface."
- "Implement deterministic mock regulator and IDV adapters plus a placeholder imported-data regulator adapter seam that downstream work can back with `fsraLicenses` without renaming contracts."
- "Implement a WorkOS-backed email-verification helper/contract that structurally enforces `verified email before trusted IDV` and is testable without a second email-verification system."
- "Add fail-closed outcome mapping for unavailable providers, malformed callbacks, stale regulator data, unsupported provinces, and missing config using the shared recommendation vocabulary."

## Implementation notes
- Mirror the existing transfer registry pattern so provider mode selects implementations in one place instead of leaking switches into future mutations, effects, or routes.
- The imported-FSRA adapter is a contract seam only in ENG-315; it should not create the backing table or import workflow.
- The email-verification contract should normalize existing WorkOS-backed auth state into a backend-friendly result and guard helper. Prefer explicit helper inputs over widening high-blast-radius auth context unless impact analysis justifies it.
- Fail-closed helpers should return normalized recommendation vocabulary and reason codes so later slices can reuse them instead of re-encoding policy.

## Existing code touchpoints
- `convex/payments/transfers/providers/registry.ts` is the local registry reference for provider-mode dispatch.
- `convex/auth.ts` already registers `authentication.email_verification_succeeded`, but it is log-only today.
- `convex/fluent.ts` currently exposes viewer auth identity without an `emailVerified` field, which is a potential blast-radius point if changed.

## Validation
- `src/test/convex/onboarding/verification-contracts.test.ts`
- `src/test/convex/onboarding/workos-email-verification.test.ts`
- `bun typecheck`
