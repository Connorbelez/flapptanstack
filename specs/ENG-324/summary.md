# Summary: ENG-324 - Broker onboarding: ship admin review queue and override workflow

- Source issue: https://linear.app/fairlend/issue/ENG-324/broker-onboarding-ship-admin-review-queue-and-override-workflow
- Primary plan: https://www.notion.so/349fc1b440248176bf48f658f6df058d
- Supporting docs:
  - https://www.notion.so/349fc1b440248125bd94dc0fd00f356b
  - https://www.notion.so/349fc1b440248116b199f91bf374cb4d
  - https://www.notion.so/349fc1b440248106b28ef8aef78a2ace
  - https://www.notion.so/317fc1b44024811b8f51fc75a9f18350
  - https://www.notion.so/317fc1b44024815a97e6cd8ae2cbbcc2

## Scope
- Add FairLend-staff broker-onboarding review queue and dossier projections over `brokerOnboardingApplications`.
- Add admin review command surfaces for reviewer notes, approve, request changes, and reject with explicit reviewer reasoning.
- Ensure request-changes carries reopened field scope and explicit reverification flags.
- Surface normalized verification evidence, reason codes, portal setup context, append-only review entries, audit history, and downstream approval-vs-activation state.
- Add protected admin route and split-view workspace with queue, dossier, thread, and review actions.
- Add targeted backend and route/component tests plus required validation commands.

## Constraints
- Use fluent-convex exports with explicit `.public()` or `.internal()`.
- Use `adminQuery` / `adminMutation` plus `requirePermission("onboarding:review")` for the review workspace so FairLend staff boundary and explicit onboarding permission are both structural.
- Do not reuse `RecordNotesPanel`; the review thread is append-only and typed as `reviewer_note`, `broker_note`, or `system_event`.
- Do not recompute verification policy or parse raw vendor payloads in React; backend projections must expose normalized summaries.
- Do not change `executeTransition` or shared GT semantics; review actions must call aggregate-owned command surfaces.
- Keep `approved` distinct from `activated`, and expose downstream `onboardingRequest` / handoff status to operations.
- Preserve broker-facing note ingestion through the existing `appendBrokerNote` path into the same review thread.

## Open questions
- none
