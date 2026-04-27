# Chunk Context: chunk-03-permissions-and-tests

## Goal
- Make the onboarding review/manage contract explicit in runtime and docs, then lock the new seams with focused automated tests.

## Relevant plan excerpts
- "Reconcile the `onboarding:review` / `onboarding:manage` contract so later slices can consume it without guessing."
- "Keep both slugs explicit, document `onboarding:review` for reviewer decisions and `onboarding:manage` for operational repair/bulk/admin-only actions, and align the RBAC doc with the runtime catalog."
- "Add focused tests that lock provider selection, email-verification normalization, recommendation vocabulary, and permission-contract alignment."

## Implementation notes
- `approveRequest` and `rejectRequest` already enforce `onboarding:review`, while onboarding list/history reads enforce `onboarding:manage`. ENG-315 should document that split rather than collapse it.
- The catalog drift test already checks runtime-enforced permissions against the canonical catalog. ENG-315 should extend coverage so the onboarding permission contract also stays aligned with the RBAC document.
- If the issue remains backend-only, no Storybook or e2e additions are expected.

## Existing code touchpoints
- `convex/onboarding/mutations.ts` and `convex/onboarding/queries.ts` are the runtime consumers that prove the permission split already exists.
- `convex/auth/permissionCatalog.ts` is the canonical runtime permission catalog.
- `docs/architecture/rbac-and-permissions.md` is the canonical documentation source and now reflects the explicit `onboarding:review` / `onboarding:manage` split.
- `src/test/auth/permissions/catalog-sync.test.ts` is the existing drift-check harness for permission catalog coverage.

## Validation
- `src/test/convex/onboarding/verification-contracts.test.ts`
- `src/test/convex/onboarding/workos-email-verification.test.ts`
- auth permission/doc-alignment tests for onboarding review/manage
