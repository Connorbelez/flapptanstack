# Summary: ENG-353 - MIC portal: add public access request intake

- Source issue: https://linear.app/fairlend/issue/ENG-353/mic-portal-add-public-access-request-intake
- Primary plan: https://www.notion.so/34efc1b4402481d68a8ec1a3014c9fae
- Supporting docs:
  - https://www.notion.so/33ffc1b4402481f3b1f5d84c9cf98b0b
  - https://www.notion.so/2c4fc1b4402480cb98aaeb208ad3fd69
  - https://www.notion.so/2c4fc1b44024802ca426d1e8d61138ee

## Scope
- Add a dedicated `micInvestorAccessRequests` Convex table with fields and indexes from the Linear contract.
- Add typed validators, a governed lifecycle machine, engine entity type registration, and module-map entries.
- Add a public unauthenticated fluent-convex mutation that accepts `portalId` and email, validates an active published MIC portal, normalizes email, dedupes pending/approved requests, allows rejected resubmission, writes creation audit journal/log entries, and returns `{ ok: true, status: "received" }`.
- Add Convex tests for normalization, invalid input, portal fail-closed paths, duplicate behavior, rejected resubmission, unauthenticated access, and audit rows.
- Run codegen, checks, typecheck, targeted tests, onboarding regression tests, and final spec audit.

## Constraints
- Do not reuse `onboardingRequests` or authenticated onboarding role request logic.
- Public intake must not require WorkOS auth and must not leak whether the submitted email is pending, approved, rejected, or known.
- Creation may insert `pending_review`; later review transitions must go through the Transition Engine.
- Provisioning state stays separate from review status.
- Use typed validators and no `any`.
- `appendAuditJournalEntry` has CRITICAL GitNexus blast radius and is call-only for this work; do not edit it.

## GitNexus Impact Notes
- `entityTypeValidator`: LOW, 0 direct impacted symbols.
- `ENTITY_TABLE_MAP`: LOW, 0 direct impacted symbols.
- `machineRegistry`: LOW, 0 direct impacted symbols.
- `convexModules`: LOW, 0 direct impacted symbols.
- `requestRole`: LOW, 0 direct impacted symbols; inspect only, do not modify.
- `appendAuditJournalEntry`: CRITICAL, 14 direct callers, 4 affected processes; call existing contract only.

## Open questions
- none
