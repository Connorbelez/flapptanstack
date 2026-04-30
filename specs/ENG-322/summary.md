# Summary: ENG-322 - Broker onboarding: ship production self-serve wizard and branded preview

- Source issue: https://linear.app/fairlend/issue/ENG-322/broker-onboarding-ship-production-self-serve-wizard-and-branded-preview
- Primary plan: https://www.notion.so/349fc1b44024816a8072f541978c3767
- Supporting docs:
  - https://www.notion.so/30ffc1b440248007a921c855c6e6adfa
  - https://www.notion.so/349fc1b440248125bd94dc0fd00f356b
  - https://www.notion.so/349fc1b440248116b199f91bf374cb4d
  - https://www.notion.so/349fc1b440248106b28ef8aef78a2ace

## Scope
- Replace the placeholder `/onboard` route with a public intro and authenticated broker onboarding experience.
- Render the wizard, submitted status, changes-requested corrections, approved state, and activated state from `brokerOnboardingApplication` server projections.
- Preserve route referral context through sign-in or sign-up, start/resume, draft save, and submit.
- Use shared portal contracts plus a server-backed availability query for slug normalization, reserved-word handling, host preview, and uniqueness feedback.
- Add a dedicated append-only broker review-thread composer that calls `appendBrokerNote`.
- Add focused route/component tests for intro, resume, teaser preview, status states, corrections, broker notes, and approved-vs-activated handling.

## Constraints
- Do not build a client-owned lifecycle state machine; top-level status comes from the aggregate.
- Do not keep canonical progress, submission state, review state, or activation state only in local state or URL params.
- Do not fork portal slug or host logic away from `shared/portal/contracts.ts`.
- Do not reuse generic mutable CRM notes for broker-review conversation.
- WorkOS AuthKit remains the auth source; use existing host-aware sign-in/sign-up and route context.
- `approved` means application-approved and provisioning may still be in flight; `activated` means downstream provisioning and portal assignment are complete.
- Backend contracts from ENG-316, ENG-319, and ENG-320 are present and must be consumed rather than redefined.

## GitNexus Impact Notes
- Indexed this worktree with `npx gitnexus analyze` before edit planning.
- `getCurrent`: LOW risk, no upstream dependents found.
- `resolvePortalByHost`: LOW risk, no upstream dependents found.
- `buildBrokerOnboardingApplicationReadModel`: MEDIUM risk, 5 direct callers in broker-application query/mutation/internal modules. Avoid changing this helper unless required.
- `src/routes/onboard/route.tsx:Route`: GitNexus context found no incoming or outgoing references for the route export. Direct impact CLI cannot disambiguate common `Route` symbols, so this is treated as LOW risk with file-scoped context.

## Open questions
- none
