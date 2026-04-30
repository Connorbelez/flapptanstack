# Chunk Context: chunk-02-admin-workspace-ui

## Goal
- Build the protected admin split-view workspace for broker-onboarding review: queue on the left, dossier and actions on the right.

## Relevant plan excerpts
- "The review workspace is an inbox-style split view with queue on the left and dossier on the right."
- "The queue supports at least Submitted, Changes Requested, Recently Updated, and Rejected views."
- "Keep queue and dossier components driven by normalized backend summaries rather than raw vendor payload parsing."

## Implementation notes
- Add a dedicated `/admin/broker-onboarding` route under the existing admin shell.
- Route auth should require FairLend staff semantics and onboarding review permission in frontend route rules, while Convex remains the structural enforcement point.
- UI components should render backend projection fields directly: verification recommendation, reason codes, regulator freshness/status, IDV status, evidence references, portal selection, review thread, audit/history, and downstream handoff.
- Use familiar controls: tabs for queue views, icon buttons where appropriate, textarea/dialog/select/checkbox inputs for review actions.

## Existing code touchpoints
- `src/lib/auth.ts`: route authorization rule and admin path mapping.
- `src/routes/admin/route.tsx`: parent admin shell.
- `src/routes/admin/broker-onboarding/route.tsx`: new route.
- `src/components/admin/broker-onboarding/*`: new workspace components.
- `src/components/ui/*`: existing ShadCN primitives.

## Validation
- `bun run test -- src/test/routes/admin/brokerOnboardingReview.test.tsx`
- `bun check`
- `bun typecheck`
