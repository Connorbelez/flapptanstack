# Status: chunk-03-tests-validation-audit

- Result: blocked
- Last updated: 2026-04-25T16:54:01Z

## Completed tasks
- T-900: `bunx convex codegen` passed.
- T-901: `bun check` passed with existing repo warnings.
- T-902: `bun typecheck` passed.
- T-903: Targeted participant/backend architecture tests passed.

## Validation
- `bunx convex codegen`: pass
- `bun check`: pass, existing warning backlog remains.
- `bun typecheck`: pass
- Targeted tests: pass
- `bun run test`: fail, unrelated AMPS demo lifecycle tests fail.
- `bun run test:e2e --project=participant-workspaces e2e/deal-closing/participant-workspaces.spec.ts`: fail after auth setup; app cannot call new Convex query because dev deployment does not have the new public function.
- `bunx convex dev --once`: fail due existing invalid `portals.portalType = "mic"` row.
- `bun run review`: not-run
- `$linear-pr-spec-audit`: not-run

## Notes
- This chunk cannot close until the dev deployment schema/data blocker and unrelated AMPS test failures are resolved or waived.
