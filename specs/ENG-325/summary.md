# Summary: ENG-325 - Broker onboarding: converge Account Claim onto broker resolve-or-provision

- Source issue: https://linear.app/fairlend/issue/ENG-325/broker-onboarding-converge-account-claim-onto-broker-resolve-or
- Primary plan: https://www.notion.so/349fc1b440248150b8bec7b805d88ec3
- Supporting docs:
  - https://www.notion.so/313fc1b4402481f9a6d7f7d775d7d7d1
  - https://www.notion.so/317fc1b44024811b8f51fc75a9f18350
  - https://www.notion.so/30ffc1b440248007a921c855c6e6adfa
  - https://www.notion.so/349fc1b440248106b28ef8aef78a2ace

## Scope
- Add a backend broker claim-convergence helper with explicit outcomes for safe reuse, self-serve fallback, and manual review.
- Reuse the ENG-320 broker resolve-or-provision, broker portal upsert, and home-portal synchronization seams for safe claim matches.
- Add a thin internal harness callable so future claim UI can exercise the contract without inventing identity rules.
- Add targeted Convex tests for safe-match reuse, ambiguous-match failure, duplicate prevention, portal assignment reuse, and fallback routing outcomes.

## Constraints
- Do not create duplicate broker rows for claimed brokers who already exist.
- Do not create claim-only portal assignment, slug, or activation logic.
- Do not trust weak or ambiguous matches; fail closed into manual review when identifiers conflict.
- Do not silently provision a new broker when no safe claim match exists.
- Keep `syncUserHomePortalAssignmentByUserId` unchanged; GitNexus reports HIGH blast radius for edits to that shared portal seam.
- Existing impact analysis: `resolveOrProvisionBrokerForActivation` LOW risk, `ensureBrokerPortalForActivation` LOW risk, `syncUserHomePortalAssignmentByUserId` HIGH risk if modified.

## Open questions
- none
