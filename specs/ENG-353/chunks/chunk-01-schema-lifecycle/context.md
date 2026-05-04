# Chunk Context: chunk-01-schema-lifecycle

## Goal
- Add the persistent MIC request entity, typed validators, governed lifecycle machine, and additive engine/test registrations.

## Relevant plan excerpts
- Entity: `micInvestorAccessRequests` with `email`, `normalizedEmail`, `portalId`, `status`, `requestedAt`, review metadata, provisioning metadata, `lastTransitionAt`, and optional typed `machineContext`.
- Indexes: `by_portal_status`, `by_portal_email_status`, `by_portal_provisioning_state`, `by_requested_at`.
- Lifecycle: `pending_review -> approved | rejected`; provisioning state is separate from review status.

## Implementation notes
- Add validators in `convex/micInvestorAccessRequests/validators.ts`.
- Use `v.optional(v.object({}))` or omit machine context if no context is needed; do not use `any`.
- Add `micInvestorAccessRequest` to `entityTypeValidator`, `EntityType`, `GovernedEntityType`, `ENTITY_TABLE_MAP`, and `machineRegistry`.
- Add module-map entries for new Convex files so convex-test can load them.

## Existing code touchpoints
- `convex/schema.ts`: add table near onboarding/GT area.
- `convex/engine/validators.ts`: GitNexus LOW risk.
- `convex/engine/types.ts`: GitNexus LOW risk for `ENTITY_TABLE_MAP`.
- `convex/engine/machines/registry.ts`: GitNexus LOW risk.
- `convex/test/moduleMaps.ts`: GitNexus LOW risk for `convexModules`.

## Validation
- `python3 scripts/validate_execution_artifacts.py ENG-353 --repo-root "/Users/connor/.codex/worktrees/27b6/fairlendapp" --stage ready-to-edit`
- Targeted tests after chunk 03.
- `bunx convex codegen` after schema changes.
