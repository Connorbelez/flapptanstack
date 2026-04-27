# Chunk Context: chunk-01-contracts-and-policy

## Goal
- Freeze the shared broker-onboarding verification contract vocabulary and the typed verification-policy ownership that every downstream slice will consume.

## Relevant plan excerpts
- "Add code-level contracts for `RegulatorDirectoryProvider`, `IdentityVerificationProvider`, and `EmailVerificationContract`."
- "Add the shared normalized verification snapshot shape, approval-recommendation vocabulary, reason codes, evidence-reference contract, and provider-mode config ownership."
- "Add a typed verification-policy config module that owns provider mode, similarity thresholds, freshness windows, province enablement, and fallback behavior."

## Implementation notes
- Keep the shared contract module cross-runtime so Convex and frontend/admin surfaces can consume the same vocabulary.
- Prefer named unions and literal types over opaque strings where the downstream issues need stable contract names.
- The three-way verification gate requires self-reported, regulator, and IDV names plus pairwise scores and an effective score. The shared snapshot should encode enough evidence for admin review without leaking vendor-native payloads.
- Unsupported provinces, stale regulator data, missing config, provider unavailability, and malformed callbacks must all have explicit recommendation and reason-code outputs.

## Existing code touchpoints
- `shared/portal/contracts.ts` is the local reference for a small, reusable cross-runtime contract module.
- `convex/payments/transfers/interface.ts` is the local reference for a provider-interface shape that keeps business logic independent from providers.
- `convex/schema.ts` currently shows Persona-specific lender onboarding fields; ENG-315 should freeze broker-onboarding contracts specifically to avoid carrying that vendor leakage forward.

## Validation
- `src/test/convex/onboarding/verification-contracts.test.ts`
- TypeScript compile for the new shared and Convex contract modules
