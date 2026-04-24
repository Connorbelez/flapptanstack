# Summary: ENG-319 - Broker onboarding: implement verification pipeline and abuse controls

- Source issue: https://linear.app/fairlend/issue/ENG-319/broker-onboarding-implement-verification-pipeline-and-abuse-controls
- Primary plan: https://www.notion.so/349fc1b440248116b199f91bf374cb4d
- Supporting docs:
  - https://www.notion.so/317fc1b44024815a97e6cd8ae2cbbcc2
  - https://www.notion.so/317fc1b4402481bcb72be32db2a57693
  - https://www.notion.so/349fc1b44024811ba33ee1ec188bea12
  - https://www.notion.so/349fc1b440248125bd94dc0fd00f356b
  - https://www.notion.so/349fc1b4402481aeada3d3e741c05217

## Scope
- Add the backend verification runtime that combines WorkOS-backed verified-email state, imported/mock regulator evidence, and normalized IDV results into a canonical broker-onboarding verification snapshot and recommendation.
- Add name normalization and three-way Jaro-Winkler scoring so the effective score is the minimum pairwise score across self-reported, regulator, and IDV names.
- Add broker-onboarding-specific IDV session start, callback persistence, signed callback verification, and normalized callback processing without leaking vendor-native payloads into canonical application state.
- Extend the broker onboarding aggregate with explicit reverification-invalidated state and recommendation application hooks so status changes remain aggregate-owned and command-driven.
- Add abuse controls with the existing Convex rate-limiter component for IDV start, verification recompute, and callback processing.
- Add focused backend tests plus repo validation and a final spec-compliance audit.

## Constraints
- Do not invent a second lifecycle model. `brokerOnboardingApplication` status changes remain aggregate-owned and command-driven through the existing aggregate seams from ENG-316.
- Do not trust WorkOS webhook logs or mirrored DB rows as verified-email truth. Use authenticated WorkOS auth state or JWT/session claims to gate IDV start and trusted callback consumption.
- Do not patch top-level application status directly from callback handlers. Callbacks persist normalized evidence and feed aggregate-owned recommendation application.
- Consume the provider contracts and normalized snapshot vocabulary from ENG-315 and the regulator provider outputs from ENG-318 rather than redefining local enums or vendor-specific shapes.
- Keep callback storage broker-onboarding-specific; do not overload the transfer-oriented `webhookEvents` table.
- Keep the implementation additive around shared high-risk seams. GitNexus pre-edit impact for `submit`, `requestChanges`, `upsertVerificationSnapshot`, and `brokerOnboardingVerificationSnapshotValidator` is LOW with no detected upstream callers or process links.
- The scope is backend/domain only. No UI, Storybook, or E2E deliverables are required unless implementation introduces a new user-facing flow.

## Open questions
- none
