# Chunk Context: chunk-04-docs-validation-audit

## Goal
- Document the produced contracts, regenerate types, run quality gates, run final scope detection, and complete the spec audit.

## Relevant plan excerpts
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted legalRepresentation/checkout/dealAccess tests, and `bun run test` when schema/shared validators affect generated API surface.
- Before finalizing, invoke `$linear-pr-spec-audit` against ENG-359 and persist the verdict in `specs/ENG-359/audit.md`.
- Run GitNexus change detection before wrapping up.

## Implementation notes
- Docs should be concise and downstream-facing, likely under `docs/architecture/` or `convex/legalRepresentation/README.md` depending on repo convention discovered during implementation.
- E2E and Storybook are not expected because this issue has no UI surface; record that explicitly in checklist/status.

## Existing code touchpoints
- `docs/architecture/state-machines.md`
- `docs/architecture/rbac-and-permissions.md`
- `convex/_generated/*` after codegen

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted tests
- `bun run test`
- `npx gitnexus status` / change-detection equivalent
- `$linear-pr-spec-audit`
- final artifact validation
