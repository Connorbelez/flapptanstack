# Summary: ENG-315 - Broker onboarding: lock verification-provider and auth contracts

- Source issue: https://linear.app/fairlend/issue/ENG-315/broker-onboarding-lock-verification-provider-and-auth-contracts
- Primary plan: https://www.notion.so/349fc1b44024811ba33ee1ec188bea12
- Supporting docs:
  - https://www.notion.so/317fc1b44024811b8f51fc75a9f18350
  - https://www.notion.so/317fc1b44024815a97e6cd8ae2cbbcc2

## Scope
- Freeze broker-onboarding verification, provider, and auth seams in code so downstream issues consume exact contracts instead of re-deciding architecture.
- Add a cross-runtime broker-onboarding contract module for normalized verification snapshots, approval recommendations, reason codes, evidence references, province/policy types, and fail-closed outcomes.
- Add backend provider interfaces, typed verification policy/config ownership, a strategy-selected registry, deterministic mock providers, and a placeholder imported-FSRA adapter seam.
- Add a WorkOS-backed email-verification contract that makes "verified email before trusted IDV" explicit and testable without introducing a second source of truth.
- Reconcile the `onboarding:review` / `onboarding:manage` contract in runtime/catalog code and the canonical RBAC documentation.
- Add focused tests for provider selection, normalization, email-verification gating, fail-closed recommendation mapping, and permission/doc alignment.

## Constraints
- WorkOS AuthKit remains the canonical source of truth for auth state and verified email. No FairLend-owned OTP or parallel email-verification system is introduced.
- The richer broker flow stays separate from the current `onboardingRequest` GT and later hands approved applications into the existing provisioning seam.
- Provider seams must stay dependency-injected or strategy-selected. No route-local, mutation-local, or GT-effect-local vendor branching.
- Provider-native payloads must be normalized before they reach shared/domain contracts. Launch evidence policy is normalized snapshots plus evidence references, not raw local ID retention.
- Ontario is the only launch province. Unsupported provinces, stale regulator data, malformed callbacks, unavailable providers, and missing config must fail closed into explicit review or unsupported outcomes.
- Reuse existing shared patterns such as `shared/portal/contracts.ts` and `convex/payments/transfers/*` rather than creating parallel contract idioms.
- Do not create the broker application aggregate, `fsraLicenses`, or the production onboarding wizard in this issue unless an unavoidable contract blocker forces it.

## Open questions
- none
