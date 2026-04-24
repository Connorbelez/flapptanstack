# Chunk Context: chunk-02-final-review-ui

## Goal
- Add the final review screen and activation/remediation controls inside the Velocity admin workspace flow.

## Relevant plan excerpts
- Final review must show immutable mortgage economics, borrower identities and roles, subject property facts, bank input summary, PAD evidence, Rotessa inputs, payment schedule preview, listing publication timing, and provenance identifiers.
- Activation button is disabled until backend readiness allows activation. There is no force-activate override.
- If Velocity-owned core data changes after review, activation is disabled and fresh review is required.

## Implementation notes
- Use `useQuery`, `useMutation`, and `useAction` consistent with existing `VelocityWorkspacePage`.
- Use existing route protection inherited from `/admin`; no new auth policy key is needed for `/admin/velocity*`.
- Add a route-backed final review page with admin pending/error state.
- Retry should call the same backend `activateVelocityPackage` action with reviewed snapshot args; backend resumes/reuses activation artifacts by idempotency key.

## Existing code touchpoints
- `src/components/admin/velocity/VelocityWorkspacePage.tsx`: add navigation to final review.
- `src/components/admin/velocity/VelocityFinalReviewPage.tsx`: create.
- `src/components/admin/velocity/VelocityActivationStatusPanel.tsx`: create.
- `src/routes/admin.velocity.$workspaceId.review.tsx` or equivalent route file: create.
- `src/routes/admin/$entitytype.$recordid.tsx`: may remain unchanged if final review has a dedicated route.

## Validation
- Targeted UI tests under `src/test/admin/velocity`.
- Route protection remains covered by `src/test/auth/route-guards.test.ts`.
