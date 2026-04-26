# Summary: ENG-354 - MIC portal: build admin triage and provisioning workflow

- Source issue: https://linear.app/fairlend/issue/ENG-354/mic-portal-build-admin-triage-and-provisioning-workflow
- Primary plan: https://www.notion.so/34efc1b44024819f9626d8fe8644141b
- Supporting docs:
  - https://www.notion.so/311fc1b4402480aa99c0feba9c1bfacc
  - https://www.notion.so/33ffc1b4402481f3b1f5d84c9cf98b0b
  - https://www.notion.so/326fc1b4402481829adfcc10b7674385

## Scope
- Add admin list/filter and detail/history queries for `micInvestorAccessRequests`.
- Add admin approve/reject mutations that use the governed transition engine.
- Add internal request/provisioning helpers and a WorkOS provisioning effect that resolves or creates users, creates MIC org membership with `roleSlug="micinvestor"`, stores WorkOS ids, and records visible failures.
- Keep provisioning state separate from review status: approved requests remain `status="approved"` even when provisioning fails.
- Add idempotency for active provisioning journal ids and already-existing WorkOS users/memberships.
- Add admin navigation/entity registration only to the extent needed to expose the triage entity through existing admin shell patterns.
- Add Convex tests for list/detail, approve, reject, provisioning success, idempotent membership, failure visibility, retry guards, and non-admin rejection.

## Constraints
- Admin approval is the access-grant event; no second manual invite workflow.
- Approval and rejection must use `executeTransition` / the transition engine rather than direct status patches.
- WorkOS provisioning must use `portal.orgId` and `roleSlug="micinvestor"` from the MIC portal contract.
- Do not infer MIC organization from email domain, org ownership, or membership.
- Do not grant lender, broker, borrower, lawyer, underwriter, or admin roles to MIC investors.
- Do not hide provisioning exceptions; failed provisioning remains admin-visible with `provisioningError`.
- Exported Convex functions must use fluent builders with explicit `.public()` or `.internal()` visibility unless they are internal Convex runtime helpers.
- No `any` types for new implementation.

## Open questions
- No code-blocking product question. Real WorkOS provisioning still depends on the human-created `micinvestor` role in WorkOS.

## Dependency state
- ENG-352 is locally present at commit `fc4327a86` and provides MIC portal/RBAC/mapping contracts.
- ENG-353 is locally present at commit `2b4f9dee9` and provides the request table, validators, public mutation, and base machine.
- Linear still shows ENG-352 in review and ENG-353 in progress, so this branch is based on the local dependency commits in this worktree.

## GitNexus blast radius notes
- `getWorkosProvisioning`: LOW risk, 4 direct dependents, shared with onboarding and origination code.
- `ADMIN_ENTITIES`: LOW risk, no direct dependents reported.
- `machineRegistry`: LOW risk, no direct dependents reported.
- `appendAuditJournalEntry`: CRITICAL if modified; this issue will only call it through existing patterns, not edit it.
- `executeTransition`: CRITICAL if modified; this issue will only call it, not edit it.
