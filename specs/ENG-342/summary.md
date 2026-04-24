# Summary: ENG-342 - Deal closing: add envelope attempts, webhooks, and signing exceptions

- Source issue: https://linear.app/fairlend/issue/ENG-342/deal-closing-add-envelope-attempts-webhooks-and-signing-exceptions
- Primary plan: https://www.notion.so/34cfc1b44024819fa197fa2164623f46
- Supporting docs:
  - https://www.notion.so/317fc1b4402481a0964ded0ec547a9de
  - https://www.notion.so/325fc1b4402481b280cffd2722b36c6a
  - ENG-338 normalized participant/access/fraction contract

## Scope
- Add Convex signing workflow state for Documenso envelope attempts, recipient progress, provider events, signing exceptions, and reissue lineage.
- Add backend operations for creating attempts from signable package instances, recording send/reissue/reminder actions, processing verified provider webhooks, and projecting signing state.
- Integrate signing state with deal/package projections while preserving signable placeholder download hiding.
- Add focused backend tests and run repo validation gates.

## Constraints
- Document Engine remains consumer-agnostic and does not create live Documenso envelopes.
- Envelope state is subordinate to the governed deal lifecycle; `ALL_PARTIES_SIGNED` must be emitted through the internal transition path only after required active recipients complete.
- Invalid/missing Documenso webhook secrets are rejected before events are persisted as truth.
- Embedded signing token data is sensitive and only returned for the authenticated current recipient.
- Recipient/package/signatory changes after send create a new attempt with lineage instead of mutating in-flight provider state.
- Exported Convex functions must use fluent-convex with explicit `.public()` or `.internal()` where applicable.
- GitNexus impact: package creation/work items/surface/webhook persistence are LOW; `executeTransition` is CRITICAL, so this implementation must not modify its contract.

## Open questions
- Documenso's exact webhook signature header and event payload fields must remain isolated behind normalization helpers so provider docs can be confirmed without changing domain state contracts.
