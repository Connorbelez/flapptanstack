# Summary: ENG-364 - Legal representation: add lender and admin lawyer status controls

- Source issue: https://linear.app/fairlend/issue/ENG-364/legal-representation-add-lender-and-admin-lawyer-status-controls
- Primary plan: https://www.notion.so/350fc1b44024813e95a8e6aff4bba6d8
- Supporting docs:
  - https://www.notion.so/315fc1b44024815ebee7cfaacf5340ec
  - https://www.notion.so/315fc1b440248183b0aecb54e4794076
  - https://www.notion.so/315fc1b4402481bbb3bcde38ca5960f6
  - https://www.notion.so/313fc1b4402481e59483ec6db372777a

## Scope
- Add a backend legal representation status projection for deal detail/read models.
- Expose lender/admin status visibility before `documentReview.pending`.
- Add server-authorized management mutations for pending guest invite resend, guest email change, and lawyer replacement before representation is confirmed.
- Preserve soft-revoked dealAccess rows, revoke stale invitations, supersede pending engagement evidence, and audit management actions.
- Add focused tests for status projection, action authorization, stale/denial cases, and replacement cleanup.

## Constraints
- Deal status can only change through the Transition Engine.
- No stale `LEGAL_CONFIRMED` or `awaiting_legal_confirmation` code vocabulary; map to current statuses such as `REPRESENTATION_CONFIRMED` and `lawyerOnboarding.*`.
- Do not leave two active lawyer dealAccess rows for the same deal after replacement.
- Do not allow lender/admin controls to bypass ENG-363 verification or engagement gates.
- Preserve `dealAccess` soft-delete behavior; never hard-delete historical access.
- Do not expose raw tokens or sensitive lawyer evidence in lender/admin projections.
- Replacement after `lawyerOnboarding.verified` or `documentReview.pending` is rejected for this slice; no new backward state-machine transition is added without human approval.

## Open questions
- none
