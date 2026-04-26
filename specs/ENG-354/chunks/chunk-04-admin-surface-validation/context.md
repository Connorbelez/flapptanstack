# Chunk Context: chunk-04-admin-surface-validation

## Goal
- Expose MIC access requests through the existing admin shell if viable, regenerate code, run required gates, and complete spec audit.

## Relevant plan excerpts
- "Admin navigation/entity registration for MIC access requests."
- "Admin route or navigation entry only to the degree needed to expose triage; detailed visual polish belongs with UI work if substantial."
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted MIC request/provisioning tests, existing onboarding effect tests if WorkOS adapter changes.

## Implementation notes
- `src/components/admin/shell/entity-registry.ts` supports generic admin entity routing through `/admin/$entitytype`; add a MIC access request entity only if it does not create a dead navigation entry.
- Run `bunx convex codegen` after new Convex modules are added.
- Update `convex/test/moduleMaps.ts` if codegen or tests do not pick up new modules automatically.
- Run `$linear-pr-spec-audit` via the available workflow and persist the final result in `specs/ENG-354/audit.md`.

## Existing code touchpoints
- `src/components/admin/shell/entity-registry.ts`: GitNexus LOW risk for `ADMIN_ENTITIES`.
- `src/routes/admin/$entitytype.tsx`: generic entity route.
- `convex/test/moduleMaps.ts`: may need regenerated entries for new Convex modules.

## Validation
- Targeted MIC tests, onboarding effect regression tests if applicable, `bunx convex codegen`, `bun check`, `bun typecheck`, final artifact validation, GitNexus detect changes, and `$linear-pr-spec-audit`.
